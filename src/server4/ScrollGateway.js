import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';
import {CachedMap, CachedValue} from '../cached.js';
import {EVMProver} from '../vm2.js';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

export class ScrollGateway extends EZCCIP {
	static mainnet(a) {
		// https://docs.scroll.io/en/developers/scroll-contracts/
		// https://etherscan.io/address/0xc4362457a91b2e55934bdcb7daaf6b1ab3ddf203#code
		return new this({
			//ScrollChain: '0xa13BAF47339d63B743e7Da8741db5456DAc1E556',
			ScrollChainCommitmentVerifier: '0xc4362457a91b2e55934bdcb7daaf6b1ab3ddf203',
			ScrollAPI: 'https://mainnet-api-re.scroll.io/api/',
			...a,
		});
	}
	constructor({
		provider1,
		provider2,
		ScrollChainCommitmentVerifier,
		ScrollAPI,
		rollup_depth = 10,
		rollup_freq = 60000, // every minute
		rollup_step = 16,
	}) {
		super();
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.rollup_step = BigInt(rollup_step);
		this.api = new URL(ScrollAPI);
		this.ScrollChainCommitmentVerifier = new ethers.Contract(ScrollChainCommitmentVerifier, [
			'function rollup() view returns (address)',
			'function poseidon() view returns (address)',
			'function verifyZkTrieProof(address account, bytes32 storageKey, bytes calldata proof) view returns (bytes32 stateRoot, bytes32 storageValue)'
		], provider1);
		this.poseidon = new CachedValue(async () => {
			return new ethers.Contract(await this.ScrollChainCommitmentVerifier.poseidon(), [
				'function poseidon(uint256[2], uint256) external view returns (bytes32)'
			], this.provider1);
		}, {ms: 60000 * 60});
		// this.scrollChain = new ethers.Contract(ScrollChain, [
		// 	'function lastFinalizedBatchIndex() returns (uint256)',
		// ], provider1);
		//this.latest_index = new CachedValue(() => this.scrollChain.lastFinalizedBatchIndex(), {ms: 60000});
		this.latest_index = new CachedValue(async () => {
			// since we need /batch api to convert index to block
			// rpc lastFinalizedBatchIndex() is likely always ahead of the indexer
			// so we use this command instead
			let res = await fetch(new URL('./last_batch_indexes', this.api))
			if (!res.ok) throw new Error(`${url}: ${res.status}`);
			let json = await res.json();
			return BigInt(json.finalized_index);
		}, {ms: rollup_freq});
		this.call_cache = new CachedMap({max_cached: 1000});
		this.commit_cache = new CachedMap({ms: rollup_depth * rollup_freq * rollup_step, max_cached: rollup_depth});
		this.register(`proveRequest(bytes when, tuple(bytes ops, bytes[] inputs)) returns (bytes)`, async ([when, [ops, inputs]], context, history) => {
			let [index] = ABI_CODER.decode(['uint256'], when);
			if (index % this.rollup_step) throw new Error(`not aligned: ${index} expect mod ${this.rollup_step}`);
			let hash = ethers.keccak256(context.calldata);
			history.show = [hash];
			return this.call_cache.get(hash, async () => {
				let commit = await this.commit_cache.get(index, async x => {
					let latest = await this.latest_index.get();
					let lag = Number((latest - index) / this.rollup_step);
					if (lag < -1) throw new Error(`too new: ${index} is ${lag} from ${latest}`);
					if (lag > this.commit_cache.max_cached) throw new Error(`too old: ${index} is +${lag} from ${latest}`)
					return this.fetch_commit(x);
				});
				let prover = new EVMProver(this.provider2, commit.block, commit.slot_cache);
				let result = await prover.evalDecoded(ops, inputs);
				let {proofs, order} = await prover.prove(result.needs);
				return ethers.getBytes(ABI_CODER.encode(['bytes[][]', 'bytes'], [proofs, Uint8Array.from(order)]));
			});
		});
	}
	async poseidon_hash(a, b, domain) {
		let p = await this.poseidon.get();
		return p.poseidon([a, b], domain);
	}
	async latest_prover() {
		let index = await this.latest_index.get();
		let commit = await this.commit_cache.get(index, x => this.fetch_commit(x));
		return new EVMProver(this.provider2, commit.block, commit.slot_cache);
	}
	async block_from_index(index) {
		let url = new URL('./batch', this.api);
		url.searchParams.set('index', index);
		let res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: ${res.status}`);
		let json = await res.json();
		let {batch: {rollup_status, end_block_number}} = json;
		if (rollup_status != 'finalized') throw new Error(`not finalized: ${rollup_status}`);
		return '0x' + end_block_number.toString(16);
	}
	async fetch_commit(index) {
		let block = await this.block_from_index(index);
		let {stateRoot, hash: blockHash} = await this.provider2.getBlock(block);
		return {
			index,
			block,
			stateRoot,
			blockHash,
			slot_cache: new CachedMap({max_cached: 512}),
		};
	}
	shutdown() {
		this.provider1.destroy();
		this.provider2.destroy();
	}
}
