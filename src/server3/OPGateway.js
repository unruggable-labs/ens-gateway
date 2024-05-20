import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';
import {SmartCache} from '../SmartCache.js';
import {MultiExpander} from '../MultiExpander.js';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

export class OPGateway extends EZCCIP {
	static op_mainnet(a) {
		// https://docs.optimism.io/chain/addresses
		return new this({
			L2OutputOracle: '0xdfe97868233d1aa22e815a266982f2cf17685a27',
			...a,
		});
	}
	static base_mainnet(a) {
		// https://docs.base.org/docs/base-contracts
		return new this({
			L2OutputOracle: '0x56315b90c40730925ec5485cf004d835058518A0',
			...a
		});
	}
	constructor({provider1, provider2, L2OutputOracle, L2ToL1MessagePasser = '0x4200000000000000000000000000000000000016'}) {
		super();
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.L2ToL1MessagePasser = L2ToL1MessagePasser;
		this.L2OutputOracle = new ethers.Contract(L2OutputOracle, [
			'function latestOutputIndex() external view returns (uint256)',
			'function getL2Output(uint256 outputIndex) external view returns (tuple(bytes32 outputRoot, uint128 t, uint128 block))',
		], provider1);
		this.call_cache = new SmartCache({max_cached: 100});
		this.output_cache = new SmartCache({ms: 60*60000, max_cached: 10});
		this.register(`fetch(bytes context, tuple(bytes ops, bytes[] inputs)) returns (bytes)`, async ([index, {ops, inputs}], context, history) => {
			let hash = ethers.keccak256(context.calldata);
			history.show = [hash];
			return this.call_cache.get(hash, async () => {
				index = parseInt(index);
				let latest = await this.latest_index();
				if (index < latest - this.output_cache.max_cached) throw new Error('stale');
				if (index > latest + 1) throw new Error('future');
				let output = await this.output_cache.get(index, x => this.fetch_output(x));
				let expander = new MultiExpander(this.provider2, output.block, output.slot_cache);
				let values = await expander.eval(ethers.getBytes(ops), inputs);
				let [account_proofs, state_proofs] = await expander.prove(values);
				return ABI_CODER.encode(
					[
						'tuple(bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash)', // OutputRootProof
						'bytes[][]',
						'tuple(uint256, bytes[][])[]',
					],
					[[ethers.ZeroHash, output.stateRoot, output.passerRoot, output.blockHash], account_proofs, state_proofs]
				);
			});
		});
	}
	async latest_index() {
		return this.output_cache.get('LATEST', () => this.L2OutputOracle.latestOutputIndex().then(Number));
	}
	async fetch_output(index) {
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
			slot_cache: new SmartCache({max_cached: 512})
		};
	}
	shutdown() {
		this.provider1.destroy();
		this.provider2.destroy();
	}
}
