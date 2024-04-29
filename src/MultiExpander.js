import {ethers} from 'ethers';

const OP_PATH_START		= 1;
const OP_PATH_END		= 2;
const OP_PUSH			= 10;
const OP_PUSH_OUTPUT	= 11;
//const OP_PUSH_BYTE		= 12;
const OP_SLOT_ADD		= 20;
const OP_SLOT_FOLLOW	= 21;
const OP_STACK_KECCAK	= 30;
const OP_STACK_CONCAT   = 31;
const OP_STACK_SLICE	= 32;
//const OP_CONCAT = 11;

export class MultiExpander {
	constructor(provider, block, cache) {
		this.provider = provider;
		this.block = block;
		this.cache = cache;
		this.max_bytes = 1 << 13;
	}
	async getStorage(target, slot) {
		slot = ethers.toBeHex(slot);
		if (this.cache) {
			return this.cache.get(`${target}:${slot}`, () => this.provider.getStorage(target, slot, this.block));
		} else {
			return this.provider.getStorage(target, slot, this.block);
		}
	}
	async prove(outputs) {
		let targets = new Map();
		for (let output of outputs) {
			let bucket = targets.get(output.target);
			if (!bucket) {
				bucket = new Map();
				bucket.index = targets.size;
				targets.set(output.target, bucket);
			}
			output.bucket = bucket;
			output.slots.forEach(x => bucket.set(x, null));
		}
		await Promise.all(Array.from(targets, async ([target, bucket]) => {
			let slots = [...bucket.keys()];
			let proof = await this.provider.send('eth_getProof', [target, slots.map(x => ethers.toBeHex(x)), this.block]);
			bucket.proof = proof.accountProof;
			slots.forEach((key, i) => bucket.set(key, proof.storageProof[i].proof));
		}));
		return [
			Array.from(targets.values(), x => x.proof),
			outputs.map(output => [output.bucket.index, output.slots.map(x => output.bucket.get(x))])
		];
		//return outputs.map(output => [output.bucket.proof, output.slots.map(x => output.bucket.get(x))]);
	}
	async eval(ops, inputs) {
		console.log({ops, inputs});
		let pos = 0;
		let slot = 0n;
		let target;
		let outputs = [];
		let stack = [];
		const read_byte = () => {
			let op = ops[pos++];
			if (pos > ops.length) throw new Error('op overflow');
			return op;
		};
		const pop_stack = () => {
			if (!stack.length) throw new Error('stack underflow');
			return stack.pop();
		};
		const expected = read_byte();
		while (pos < ops.length) {
			try {
				let op = ops[pos++];
				switch (op) {
					case OP_PATH_START: {
						target = pop_stack();
						break;
					}
					case OP_PATH_END: {
						outputs.push(this.read_output(target, slot, read_byte()));
						slot = 0n;
						break;
					}
					case OP_PUSH: { 
						stack.push(inputs[read_byte()]);
						break;
					}
					// case OP_PUSH_BYTE: {
					// 	stack.push(ethers.toBeHex(read_byte(), 32));
					// 	break;
					// }
					case OP_PUSH_OUTPUT: {
						stack.push(outputs[read_byte()].then(x => x.value()));
						break;
					}
					case OP_SLOT_ADD: {
						slot += ethers.toBigInt(await pop_stack());
						break;
					}
					case OP_SLOT_FOLLOW: {
						slot = BigInt(ethers.keccak256(ethers.concat([await pop_stack(), ethers.toBeHex(slot, 32)])));
						break;
					}
					case OP_STACK_KECCAK: {
						stack.push(ethers.keccak256(await pop_stack()));
						break;
					}
					case OP_STACK_CONCAT: {
						const n = 2;
						if (stack.length < n) throw new Error('concat underflow');
						stack.splice(stack.length-n, n, ethers.concat(await Promise.all(stack.slice(-n))));
						break;
					}
					case OP_STACK_SLICE: {
						let x = read_byte();
						let n = read_byte();
						stack.push(ethers.dataSlice(await pop_stack(), x, x + n));
						break;
					}
					default: new Error('unknown op');
				}
			} catch (err) {
				Object.assign(err, {op, ops, pos, inputs, stack, target, slot});
				throw err;
			}
		}
		if (outputs.length != expected) {
			throw Object.assign(new Error('output mismatch', {values, expected}));
		}
		return Promise.all(outputs);
	}
	async read_output(target, slot, step) {
		target = await target;
		if (!target) throw Object.assign(new Error('invalid target'), {target});
		// address(uint160(_toUint256(stack[--stackIndex]))),
		target = '0x' + (target.length >= 66 ? target.slice(26, 66) : target.slice(2).padStart(40, '0').slice(-40)).toLowerCase();
		console.log({target, slot, step});
		let first = await this.getStorage(target, slot);
		let size = parseInt(first.slice(64), 16);
		if (step == 0) { // 1 slot is the same thing is bytes(32)
			step = 1;
			size = 64;
		}
		if (step == 1 && (size & 1) == 0) {
			let p = Promise.resolve(ethers.dataSlice(first, 0, size >> 1));
			return {
				target,
				slots: [slot],
				value: () => p
			};
		}
		let count = parseInt(first) >> 1;
		size = count * step;
		if (size > this.max_bytes) throw Object.assign(new Error('value overflow'), {size, max: this.max_bytes});
		let offset = BigInt(ethers.solidityPackedKeccak256(['uint256'], [slot]));
		let slots = [slot, ...Array.from({length: (size + 31) >> 5}, (_, i) => offset + BigInt(i))];
		const getStorage = this.getStorage.bind(this, target);
		return {
			target,
			slots,
			value() {
				let p = Promise.all(this.slots.slice(1).map(getStorage)).then(v => {
					return ethers.dataSlice(ethers.concat(v), 0, size);
				});
				this.value = () => p;
				return p;
			}
		};
	}
}
