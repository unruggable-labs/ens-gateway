import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';
import {CachedMap, CachedValue} from '../cached.js';
import {EVMProver} from '../vm2.js';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

export class OPGateway extends EZCCIP {
	static base_mainnet(a) {
		// https://docs.base.org/docs/base-contracts
		return new this({
			L2OutputOracle: '0x56315b90c40730925ec5485cf004d835058518A0',
			...a
		});
	}
	constructor({
		provider1, 
		provider2, 
		L2OutputOracle, 
		L2ToL1MessagePasser = '0x4200000000000000000000000000000000000016',
		rollup_depth = 10,
		rollup_freq = 60000 * 60,
	}) {
		super();
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.L2ToL1MessagePasser = L2ToL1MessagePasser;
		this.L2OutputOracle = new ethers.Contract(L2OutputOracle, [
			'function latestOutputIndex() external view returns (uint256)',
			'function getL2Output(uint256 outputIndex) external view returns (tuple(bytes32 outputRoot, uint128 t, uint128 block))',
		], provider1);
		this.latest_index = new CachedValue(() => this.L2OutputOracle.latestOutputIndex(), {ms: 60000});
		this.call_cache = new CachedMap({max_cached: 100});
		this.commit_cache = new CachedMap({ms: rollup_freq * rollup_depth, max_cached: rollup_depth});
		this.register(`proveRequest(bytes when, tuple(bytes ops, bytes[] inputs)) returns (bytes)`, async ([when, {ops, inputs}], context, history) => {
			let hash = ethers.keccak256(context.calldata);
			history.show = [hash];
			return this.call_cache.get(hash, async () => {
				let [index] = ABI_CODER.decode(['uint256'], when);
				let commit = await this.commit_cache.get(index, async x => {
					let latest = await this.latest_index.get();
					let lag = Number(latest - x);
					if (lag < -1) throw new Error(`too new: ${index} is ${lag} from ${latest}`);
					if (lag > this.commit_cache.max_cached) throw new Error(`too old: ${index} is +${lag} from ${latest}`)
					return this.fetch_commit(x);
				});
				let prover = new EVMProver(this.provider2, commit.block, commit.slot_cache);
				let result = await prover.evalDecoded(ops, inputs);
				let {proofs, order} = await prover.prove(result.needs);
				return ABI_CODER.encode(
					[
						'tuple(bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash)', // OutputRootProof
						'bytes[][]',
						'bytes',
					],
					[[ethers.ZeroHash, commit.stateRoot, commit.passerRoot, commit.blockHash], proofs, Uint8Array.from(order)]
				);
			});
		});
	}
	async fetch_commit(index) {
		let {outputRoot, block} = await this.L2OutputOracle.getL2Output(index);
		block = '0x' + block.toString(16);
		let {storageHash: passerRoot} = await this.provider2.send('eth_getProof', [this.L2ToL1MessagePasser, [], block]);
		let {stateRoot, hash: blockHash} = await this.provider2.getBlock(block);
		return {
			index,
			block,
			outputRoot,
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
