import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';
import {SmartCache} from '../SmartCache.js';
import {MultiExpander} from '../MultiExpander.js';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

export class Arb1Gateway extends EZCCIP {
	static mainnet(a) {
		return new this({
			// https://docs.arbitrum.io/build-decentralized-apps/reference/useful-addresses
			L2Rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35', 
			...a
		});
	}
	constructor({provider1, provider2, L2Rollup}) {
		super();
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.L2Rollup = new ethers.Contract(L2Rollup, [	
			'function latestNodeCreated() external view returns (uint64)',
			`event NodeCreated(
				uint64 indexed nodeNum,
				bytes32 indexed parentNodeHash,
				bytes32 indexed nodeHash,
				bytes32 executionHash,
				tuple(
					tuple(tuple(bytes32[2] bytes32Vals, uint64[2] u64Vals) globalState, uint8 machineStatus) beforeState, 
					tuple(tuple(bytes32[2] bytes32Vals, uint64[2] u64Vals) globalState, uint8 machineStatus) afterState, 
					uint64 numBlocks
				) assertion, 
				bytes32 afterInboxBatchAcc, 
				bytes32 wasmModuleRoot, 
				uint256 inboxMaxCount
			)`,
		], provider1);
		this.call_cache = new SmartCache({max_cached: 100});
		this.node_cache = new SmartCache({ms: 60*60000, ms_error: 5000, max_cached: 10});
		this.register(`fetch(bytes context, tuple(bytes ops, bytes[] inputs)) returns (bytes)`, async ([index, {ops, inputs}], context, history) => {
			let hash = ethers.keccak256(context.calldata);
			history.show = [hash];
			return this.call_cache.get(hash, async () => {
				index = parseInt(index);
				let latest = await this.latest_index();
				if (index < latest - this.node_cache.max_cached) throw new Error('stale');
				if (index > latest + 1) throw new Error('future');
				let node = await this.node_cache.get(index, x => this.fetch_node(x));
				let expander = new MultiExpander(this.provider2, node.block, node.slot_cache);
				let values = await expander.eval(ethers.getBytes(ops), inputs);
				let [account_proofs, state_proofs] = await expander.prove(values);
				return ABI_CODER.encode(
					['bytes32', 'bytes', 'bytes[][]', 'tuple(uint256, bytes[][])[]'],
					[node.sendRoot, node.rlpEncodedBlock, account_proofs, state_proofs]
				);
			});
		});
	}
	async latest_index() {
		return this.node_cache.get('LATEST', () => this.L2Rollup.latestNodeCreated().then(Number));
	}
	async fetch_node(node) {
		let events = await this.L2Rollup.queryFilter(this.L2Rollup.filters.NodeCreated(node));
		if (events.length != 1) throw new Error(`unknown node: ${node}`);
		let [blockHash, sendRoot] = events[0].args[4][1][0][0]; //events[0].args.afterState.globalState.bytes32Vals;
		let block = await this.provider2.send('eth_getBlockByHash', [blockHash, false]);
		let rlpEncodedBlock = ethers.encodeRlp([
			block.parentHash,
			block.sha3Uncles,
			block.miner,
			block.stateRoot,
			block.transactionsRoot,
			block.receiptsRoot,
			block.logsBloom,
			ethers.toBeHex(block.difficulty),
			ethers.toBeHex(block.number),
			ethers.toBeHex(block.gasLimit),
			ethers.toBeHex(block.gasUsed),
			ethers.toBeHex(block.timestamp),
			block.extraData,
			block.mixHash,
			block.nonce,
			ethers.toBeHex(block.baseFeePerGas)
		]);
		return {
			node,
			block: block.number,
			blockHash,
			sendRoot,
			rlpEncodedBlock,
			slot_cache: new SmartCache({max_cached: 512})
		};
	}
	shutdown() {
		this.provider1.destroy();
		this.provider2.destroy();
	}
}
