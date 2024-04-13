import {ethers} from 'ethers';
import {serve, EZCCIP} from '@resolverworks/ezccip';
export {serve};

const CCIP_ABI = new ethers.Interface([
	'function prove(address target, bytes32 slot) returns (uint256 outputIndex, uint256 blockNumber, bytes32 blockRoot, bytes32 blockHash, bytes32 passerRoot, bytes accountProof, bytes[][] slotProof)'
]);


export class SingleSlotProver {
	static forBaseMainnet({provider1, provider2}) {
		// https://docs.base.org/docs/base-contracts
		if (!provider2) {
			provider2 = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, {staticNetwork: true});
		}
		return new this({
			provider1, 
			provider2,
			L2OutputOracle: '0x56315b90c40730925ec5485cf004d835058518A0',
			L2ToL1MessagePasser: '0x4200000000000000000000000000000000000016'
		});
	}
	constructor({provider1, provider2, L2OutputOracle, L2ToL1MessagePasser}) {
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.L2ToL1MessagePasser = L2ToL1MessagePasser;
		this.L2OutputOracle = new ethers.Contract(L2OutputOracle, [
			'function latestOutputIndex() external view returns (uint256)',
			'function getL2Output(uint256 outputIndex) external view returns (tuple(bytes32 outputRoot, uint128 t, uint128 block))',
		], provider1);
	}
	get ezccip() {
		let ezccip = new EZCCIP();
		ezccip.register(CCIP_ABI, async ([target, slot]) => this.prove(target, slot));
		return ezccip;
	}
	async lastOutput() {
		let index = await this.L2OutputOracle.latestOutputIndex();
		let {outputRoot, block} = await this.L2OutputOracle.getL2Output(index);
		block = '0x' + block.toString(16);
		let {storageHash: passerRoot} = await this.provider2.send('eth_getProof', [this.L2ToL1MessagePasser, [], block]);
		let {stateRoot: blockRoot, hash: blockHash} = await this.provider2.getBlock(block);
		return {index, block, outputRoot, passerRoot, blockRoot, blockHash};
	}
	async prove(target, slot) {
		let output = await this.lastOutput();
		let proof = await this.provider2.send('eth_getProof', [target, [ethers.toBeHex(slot, 32)], output.block]);
		return [
			output.index,
			output.block,
			output.blockRoot,
			output.blockHash,
			output.passerRoot,
			proof.accountProof,
			proof.storageProof.map(x => x.proof),
		];
	}
}
