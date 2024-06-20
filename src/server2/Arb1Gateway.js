import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';
import {CachedMap} from '../cached.js';
import {Expander} from '../vm1.js';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

// newer
// https://github.com/OffchainLabs/arbitrum-classic/blob/551a39b381dcea81e03e7599fcb01fddff4fe96c/packages/arb-bridge-eth/contracts/rollup/RollupCore.sol#L175
// https://github.com/OffchainLabs/arbitrum-classic/blob/551a39b381dcea81e03e7599fcb01fddff4fe96c/packages/arb-bridge-eth/contracts/rollup/IRollupCore.sol#L42	

/*
RollupLib.Assertion: 
    struct Assertion {
        ExecutionState beforeState;
        ExecutionState afterState;
        uint64 numBlocks;
    }
    struct ExecutionState {
        GlobalState globalState;
        MachineStatus machineStatus;
    }
	struct GlobalState {
		bytes32[2] bytes32Vals;
		uint64[2] u64Vals;
	}
	enum MachineStatus {
		RUNNING,
		FINISHED,
		ERRORED,
		TOO_FAR
	}
*/

export class Arb1Gateway extends EZCCIP {
	static mainnet(a) {
		return new this({
			// https://docs.arbitrum.io/build-decentralized-apps/reference/useful-addresses
			L2Rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35', 
			...a
		});
	}
	constructor({provider1, provider2, L2Rollup, expander}) {
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
		this.call_cache = new CachedMap({max_cached: 100});
		this.node_cache = new CachedMap({ms: 60*60000, ms_error: 5000, max_cached: 5});
		this.register(`getStorageSlots(bytes context, address target, bytes32[] commands, bytes[] constants) external view returns (bytes)`, async ([index, target, commands, constants], context, history) => {	
			let hash = ethers.keccak256(context.calldata);
			history.show = [hash];
			return this.call_cache.get(hash, async () => {
				index = parseInt(index);
				let latest = await this.node_cache.get('LATEST', () => this.L2Rollup.latestNodeCreated().then(Number));
				if (index < latest - this.node_cache.max_cached) throw new Error('too old');
				let node = await this.node_cache.get(index, x => this.fetch_node(x));
				let slots = await new Expander(this.provider2, target, node.block, node.slot_cache).expand(commands, constants);
				let proof = await this.provider2.send('eth_getProof', [target, slots.map(x => ethers.toBeHex(x)), node.block]);
				let witness = ABI_CODER.encode(
					['bytes32', 'bytes', 'tuple(bytes[], bytes[][])'],
					[node.sendRoot, node.rlpEncodedBlock, [proof.accountProof, proof.storageProof.map(x => x.proof)]]
				);
				return ABI_CODER.encode(['bytes'], [witness]);
			});
		});
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
			slot_cache: new CachedMap({max_cached: 512})
		};
	}
	shutdown() {
		this.provider1.destroy();
		this.provider2.destroy();
	}
}
