import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

export class OPGateway extends EZCCIP {
	static forBaseMainnet({provider1, provider2, expander}) {
		// https://docs.base.org/docs/base-contracts
		if (!provider1) {
			provider1 = new ethers.CloudflareProvider();
		}
		if (!provider2) {
			provider2 = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, {staticNetwork: true});
		}
		return new this({
			provider1, 
			provider2,
			L2OutputOracle: '0x56315b90c40730925ec5485cf004d835058518A0',
			L2ToL1MessagePasser: '0x4200000000000000000000000000000000000016',
			expander
		});
	}
	constructor({provider1, provider2, L2OutputOracle, L2ToL1MessagePasser, expander}) {
		super();
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.L2ToL1MessagePasser = L2ToL1MessagePasser;
		this.L2OutputOracle = new ethers.Contract(L2OutputOracle, [
			'function getL2Output(uint256 outputIndex) external view returns (tuple(bytes32 outputRoot, uint128 t, uint128 block))',
		], provider1);
		this.output_cache = new Map();
		this.register(`getStorageSlots(bytes context, address target, bytes32[] commands, bytes[] constants) external view returns (bytes)`, async ([context, target, commands, constants]) => {
			let output = await this.cache_output(BigInt(context));
			let slots = await expander(this.provider2, output.block, target, commands, constants);
			let proof = await this.provider2.send('eth_getProof', [target, slots.map(x => ethers.toBeHex(x, 32)), output.block]);
			let witness = ABI_CODER.encode(
				[
					'tuple(bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash)',
					'tuple(bytes[] stateTrieWitness, bytes[][] storageProofs)',
				],
				[
					{
						version: ethers.ZeroHash,
						stateRoot: output.stateRoot,
						messagePasserStorageRoot: output.passerRoot,
						latestBlockhash: output.blockHash,
					},
					{
						stateTrieWitness: proof.accountProof,
						storageProofs: proof.storageProof.map(x => x.proof),
					}
				]
			);
			return [witness];
		});
	}
	async fetch_output(index) {
		let {outputRoot, block} = await this.L2OutputOracle.getL2Output(index);
		block = '0x' + block.toString(16);
		let {storageHash: passerRoot} = await this.provider2.send('eth_getProof', [this.L2ToL1MessagePasser, [], block]);
		let {stateRoot, hash: blockHash} = await this.provider2.getBlock(block);
		return {index, block, outputRoot, passerRoot, stateRoot, blockHash};
	}
	async cache_output(index) {
		let output = this.output_cache.get(index);
		if (!output) {
			output = await this.fetch_output(index);
			this.output_cache.set(index, output);
		}
		return output;
	}
}
