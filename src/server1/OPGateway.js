import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';
import {Expander} from '../vm1.js';

export class OPGateway extends EZCCIP {
	static base_mainnet(a) {
		return new this({
			// https://docs.base.org/docs/base-contracts
			L2OutputOracle: '0x56315b90c40730925ec5485cf004d835058518A0',
			L2ToL1MessagePasser: '0x4200000000000000000000000000000000000016',
			...a
		});
	}
	constructor({provider1, provider2, L2OutputOracle, L2ToL1MessagePasser}) {
		super();
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.L2ToL1MessagePasser = L2ToL1MessagePasser;
		this.L2OutputOracle = new ethers.Contract(L2OutputOracle, [
			'function latestOutputIndex() external view returns (uint256)',
			'function getL2Output(uint256 outputIndex) external view returns (tuple(bytes32 outputRoot, uint128 t, uint128 block))',
		], provider1);
		this._last = undefined;
		this.register(`getStorageSlots(address target, bytes32[] commands, bytes[] constants) external view returns (bytes)`, async ([target, commands, constants]) => {
			let output = await this.latest_output();
			let slots = await new Expander(this.provider2, target, output.block).expand(commands, constants);
			let proof = await this.provider2.send('eth_getProof', [target, slots.map(x => ethers.toBeHex(x)), output.block]);
			let witness = ethers.AbiCoder.defaultAbiCoder().encode(
				[
					'tuple(uint256 l2OutputIndex, tuple(bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash) outputRootProof)',
					'tuple(bytes[] stateTrieWitness, bytes[][] storageProofs)',
				],
				[
					{
						l2OutputIndex: output.index,
						outputRootProof: {
							version: ethers.ZeroHash,
							stateRoot: output.stateRoot,
							messagePasserStorageRoot: output.passerRoot,
							latestBlockhash: output.blockHash,
						},
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
		return {index, block, outputRoot, passerRoot, stateRoot, blockHash, t: Date.now()};
	}
	async latest_output() {
		let index = await this.L2OutputOracle.latestOutputIndex();
		if (this._last?.index !== index) this._last = await this.fetch_output(index);
		return this._last;
	}
}
