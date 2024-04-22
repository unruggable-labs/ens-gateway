import {ethers} from 'ethers';

/*
EVMFetcher.Req memory r = EVMFetcher.create();
r.push(0x0f1449C980253b576aba379B11D453Ac20832a89); r.getSlot(); //r.push(0); r.add();
r.ref(0); r.getSlot(); r.push(8); r.add();
r.ref(0); r.getArray(1); r.push(9); r.add();
return r.debug();
*/

const OP_PATH_START = 1;
const OP_PUSH = 3;
const OP_ADD = 4;
const OP_PUSH_REF = 10;
const OP_FOLLOW = 5;
const OP_PATH_END = 9;

export class MultiExpander {
	constructor(provider, block, ops, inputs, cache) {
		this.provider = provider;
		this.block = block;
		this.ops = ops;
		this.pos = 0;
		this.cache = cache;
		this.inputs = inputs;
		this.outputs = [];
		this.stack = [];
	}
	async get(target, slot) {
		slot = ethers.toBeHex(slot);
		return this.provider.getStorage(target, slot, this.block);
	}
	next_op() {
		let pos = this.pos++;
		if (pos >= this.ops.length) throw new Error('overflow');
		return this.ops[pos];
	}
	pop_stack() {
		if (this.stack.length) throw new Error('no stack');
		return this.stack.pop();
	}
	async expand(outputs) {
		let pos = 0;
		let output = -1;
		let slot = 0n;
		let target;
		let path;
		while (pos < ops.length) {
			let op = ops[pos++];
			switch (op) {
				case OP_PATH_START: {
					if (path) this.add_output(0, slot);
					target = this.pop_stack();					
					break;
				}
				case OP_PATH_END: {
					this.add_output(this.next_op(), slot);


					path = null;
					break;
				}
				case OP_PUSH: { 
					this.stack.push(this.inputs[this.next_op()]);
					break;
				}
				case OP_PUSH_REF: {
					this.stack.push(this.outputs[this.next_op()]);
					break;
				}
				case OP_ADD: {
					slot += ethers.toBigInt(await this.stack.pop());
					break;
				}
				case OP_KECCAK: {
					this.stack.push(ethers.keccak256(ethers.concat(await Promise.all(this.stack))));
					break;
				}
				case OP_FOLLOW: {
					slot = BigInt(ethers.keccak256(ethers.concat([await this.stack.pop(), this.toBeHex(slot, 32)])));
					break;

					//console.log(await provider.getStorage(A, ethers.toBeHex(BigInt(ethers.keccak256(ethers.concat([ID_RAFFY, SLOT_RECORDS]))) + 1n, 32)));

				}
				
				case OP_SLOT: {
					slot = 0n;
					break;
				}
			}

		}
	}
	async add_output(step, slot) {
		await this.getStorage()

	}
}

export function storage_getter(provider, block) {
	return async (target, slot) => {
		slot = ethers.toBeHex(slot);
		let value = await provider.getStorage(target, slot, block);
		console.log({target, slot, value});
		return value;
	};
}

export async function expand_slots(getter, {outputs, targets, ops, constants}) {
	let requests = [];
	for (let i = 0; i < commands.length; i++) {
		requests.push(getValueFromPath(getStorage, commands[i], constants, requests.slice()));
	}
	let results = await Promise.all(requests);
	return results.flatMap(x => x.slots);
}

async function getValueFromPath(getStorage, command, constants, requests) {
	const {slot, isDynamic} = await computeFirstSlot(command, constants, requests);
	if (isDynamic) return getDynamicValue(getStorage, slot);
	return {
		slots: [slot],
		isDynamic,
		value: getStorage(slot).then(v => ethers.zeroPadValue(v, 32))
	};
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

async function getDynamicValue(getStorage, slot) {
	const firstValue = ethers.getBytes(await getStorage(slot));
	if (firstValue[31] & 0x01) {
		// Long value: first slot is `length * 2 + 1`, following slots are data.
		const len = (Number(ethers.toBigInt(firstValue)) - 1) / 2;
		const hashedSlot = BigInt(ethers.solidityPackedKeccak256(['uint256'], [slot]));
		const slotNumbers = Array.from({length: Math.ceil(len / 32)}, (_, i) => hashedSlot + BigInt(i));
		return {
			slots: [slot, ...slotNumbers],
			isDynamic: true,
			value: Promise.all(slotNumbers.map(getStorage)).then(v => {
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
