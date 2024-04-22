import {ethers} from 'ethers';

export class Expander {
	constructor(provider, target, block, cache) {
		this.provider = provider;
		this.target = target;
		this.block = block;
		this.cache = cache;
	}
	async getStorage(slot) {
		slot = ethers.toBeHex(slot);
		if (this.cache) {
			return this.cache.get(`${this.target}:${slot}`, () => this.provider.getStorage(this.target, slot, this.block));
		} else {
			return this.provider.getStorage(this.target, slot, this.block);
		}
	}
	async expand(commands, constants) {
		let requests = [];
		for (let i = 0; i < commands.length; i++) {
			requests.push(this.getValueFromPath(commands[i], constants, requests.slice()));
		}
		let results = await Promise.all(requests);
		return results.flatMap(x => x.slots);
	}
	async getValueFromPath(command, constants, requests) {
		const {slot, isDynamic} = await computeFirstSlot(command, constants, requests);
		if (isDynamic) return this.getDynamicValue(slot);
		return {
			slots: [slot],
			isDynamic,
			value: this.getStorage(slot).then(v => ethers.zeroPadValue(v, 32))
		};
	}	
	async getDynamicValue(slot) {
		const firstValue = ethers.getBytes(await this.getStorage(slot));
		if (firstValue[31] & 0x01) {
			// Long value: first slot is `length * 2 + 1`, following slots are data.
			const len = (Number(ethers.toBigInt(firstValue)) - 1) / 2;
			const hashedSlot = BigInt(ethers.solidityPackedKeccak256(['uint256'], [slot]));
			const slotNumbers = Array.from({length: Math.ceil(len / 32)}, (_, i) => hashedSlot + BigInt(i));
			return {
				slots: [slot, ...slotNumbers],
				isDynamic: true,
				value: Promise.all(slotNumbers.map(x => this.getStorage(x))).then(v => {
					return ethers.dataSlice(ethers.concat(v), 0, len);
				}),
			};
		} else {
			// Short value: least significant byte is `length * 2`, other bytes are data.
			const len = firstValue[31] / 2;
			return {
				slots: [slot],
				isDynamic: true,
				value: Promise.resolve(ethers.dataSlice(firstValue, 0, len)),
			};
		}
	}
}
	
async function computeFirstSlot(command, constants, requests) {
	const commandWord = ethers.getBytes(command);
	const flags = commandWord[0];
	const isDynamic = (flags & 0x01) != 0;
	let slot = 0n;
	for (let j = 1; j < 32; j++) {
		let op = commandWord[j];
		if (op === 0xFF) break;
		const operand = op & 0x1F;
		op >>= 5;
		switch (op) {
			case 0: {
				slot = BigInt(ethers.solidityPackedKeccak256(['bytes', 'uint256'], [constants[operand], slot]));
				continue;
			}
			case 1: {
				slot = BigInt(ethers.solidityPackedKeccak256(['bytes', 'uint256'], [await requests[operand].then(x => x.value), slot]));
				continue;
			}
			case 2: {
				slot += BigInt(constants[operand]);
				continue;
			}
			default: throw new Error(`bad op: ${op}`);
		}
	}
	return { slot, isDynamic };
}

