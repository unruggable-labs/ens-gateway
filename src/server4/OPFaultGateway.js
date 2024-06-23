import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';
import {CachedMap, CachedValue} from '../cached.js';
import {EVMProver} from '../vm2.js';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

export class OPFaultGateway extends EZCCIP {
	static mainnet(a) {
		// https://docs.optimism.io/chain/addresses
		return new this({
			OptimismPortal: '0xbEb5Fc579115071764c7423A4f12eDde41f106Ed',
			...a,
		});
	}
	constructor({
		provider1,
		provider2,
		OptimismPortal, // address of portal contract
		L2ToL1MessagePasser = '0x4200000000000000000000000000000000000016',
		game_freq = 60*60000, // every hour
		game_depth = 6, // service last 6 hours
	}) {
		super();
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.optimismPortal = new ethers.Contract(OptimismPortal, [
			'function disputeGameFactory() external view returns (address)',
			`function respectedGameType() external view returns (uint32)`,
		], provider1); 
		this.disputeGameFactory = new CachedValue(async () => {
			let [factory_address, respectedGameType] = await Promise.all([
				this.optimismPortal.disputeGameFactory(),
				this.optimismPortal.respectedGameType(),
			]);
			let factory = new ethers.Contract(factory_address, [
				`function gameAtIndex(uint256 _index) external view returns (uint32 gameType, uint64 timestamp, address gameProxy)`,
				'function gameCount() external view returns (uint256 gameCount_)',
				`function findLatestGames(uint32 gameType, uint256 _start, uint256 _n) external view returns (tuple(uint256 index, bytes32 metadata, uint64 timestamp, bytes32 rootClaim, bytes extraData)[] memory games_)`,
			], this.provider1);
			return {factory, respectedGameType};
		});
		this.latest_index = new CachedValue(async () => {
			let {factory} = await this.disputeGameFactory.get();
			let count = await factory.gameCount();
			if (count == 0) throw new Error('no games');
			return count - 1n;
		}, {ms: 60000});
		this.L2ToL1MessagePasser = L2ToL1MessagePasser;
		this.call_cache = new CachedMap({max_cached: 100});
		this.commit_cache = new CachedMap({ms: game_depth * game_freq, ms_error: 60000, max_cached: game_depth});
		this.register(`proveRequest(bytes when, tuple(bytes ops, bytes[] inputs)) returns (bytes)`, async ([when, {ops, inputs}], context, history) => {
			let hash = ethers.keccak256(context.calldata);
			history.show = [hash];
			return this.call_cache.get(hash, async () => {
				let [index] = ABI_CODER.decode(['uint256'], when);
				let commit = await this.commit_cache.get(index, async x => {
					let latest = await this.latest_index.get();
					let lag = Number(latest - index);
					if (lag < -1) throw new Error(`too new: ${index} is ${lag} from ${latest}`);
					if (lag > this.commit_cache.max_cached) throw new Error(`too old: ${index} is +${lag} from ${latest}`)
					return this.fetch_game(x);
				});
				let prover = new EVMProver(this.provider2, commit.block, commit.slot_cache);
				let result = await prover.evalDecoded(ops, inputs);
				let {proofs, order} = await prover.prove(result.needs);
				return ABI_CODER.encode(
					[
						'tuple(bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash)', // OutputRootProof
						'bytes[][]', 'bytes'
					],
					[[ethers.ZeroHash, commit.stateRoot, commit.passerRoot, commit.blockHash], proofs, order]
				);
			});
		});
	}
	async fetch_game(index) {
		let {factory, respectedGameType} = await this.disputeGameFactory.get();
		let {gameType, gameProxy} = await factory.gameAtIndex(index);
		if (gameType != respectedGameType) {
			throw new Error(`unrespected game type: ${gameType}`);
		}
		let game = new ethers.Contract(gameProxy, [
			'function l2BlockNumber() external view returns (uint256)',
			'function rootClaim() external view returns (bytes32)',
			'function status() external view returns (uint8)',
		], this.provider1);
		let [block, status] = await Promise.all([
			game.l2BlockNumber(),
			game.status()
		]);
		const CHALLENGER_WINS = 1;
		if (status == CHALLENGER_WINS) {
			throw new Error('disputed');
		}
		block = '0x' + block.toString(16);
		let [{storageHash: passerRoot}, {stateRoot, hash: blockHash}] = await Promise.all([
			this.provider2.send('eth_getProof', [this.L2ToL1MessagePasser, [], block]),
			this.provider2.getBlock(block),
		]);
		return {
			index,
			block,
			gameProxy,
			passerRoot,
			stateRoot,
			blockHash,
			slot_cache: new CachedMap({max_cached: 512})
		};
	}
	shutdown() {
		this.provider1.destroy();
		this.provider2.destroy();
	}
}
