import {ethers} from 'ethers';

const BATCH_API = new ethers.Interface([
	'function expandSlots(bytes32[] memory commands, bytes[] memory constants) external view returns (bytes[] memory m)'
]);

export async function expand_slots_with_trusted_batch(provider, block, target, commands, constants) {
	let contract = new ethers.Contract(target, BATCH_API, provider);
	let memory = await contract.expandSlots(commands, constants, {blockTag: block});
	return memory.flapMap(hex => {
		let slot0 = BigInt(hex.slice(0, 66));
		return Array.from({length: (hex.length - 66) >> 6}, (_, i) => slot0 + BigInt(i));
	});
}
