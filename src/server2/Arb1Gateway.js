import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';

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
	static mainnet({provider1, provider2, expander}) {
		// https://docs.arbitrum.io/build-decentralized-apps/reference/useful-addresses
		if (!provider1) {
			provider1 = new ethers.CloudflareProvider();
		}
		if (!provider2) {
			provider2 = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc', 42161, {staticNetwork: true});
		}
		return new this({
			provider1, 
			provider2,
			L2Rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
			expander
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
		this.cache = new Map();
		this.register(`getStorageSlots(bytes context, address target, bytes32[] commands, bytes[] constants) external view returns (bytes)`, async ([context, target, commands, constants]) => {
			let cached = await this.cached(BigInt(context));
			let slots = await expander(this.provider2, cached.block, target, commands, constants);
			let proof = await this.provider2.send('eth_getProof', [target, slots.map(x => ethers.toBeHex(x, 32)), cached.block]);
			let witness = ABI_CODER.encode(
				[
					'tuple(bytes32 version, bytes32 sendRoot, uint64 index, bytes rlpEncodedBlock)',
					'tuple(bytes[] stateTrieWitness, bytes[][] storageProofs)',
				],
				[
					{
						version: ethers.ZeroHash,
						sendRoot: cached.sendRoot,
						index: cached.nodeIndex,
						rlpEncodedBlock: cached.rlpEncodedBlock
					},
					proof,
				]
			);
			return [witness];
		});
	}
	async fetch(index) {
		let events = await this.L2Rollup.queryFilter(this.L2Rollup.filters.NodeCreated(index));
		if (events.length != 1) throw new Error(`unknown node: ${index}`);
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
			rlpEncodedBlock,
			sendRoot,
			index,
			block: block.number
		};
	}
	async cached(index) {
		let output = this.cache.get(index);
		if (!output) {
			output = await this.fetch(index);
			this.cache.set(index, output);
		}
		return output;
	}
}
