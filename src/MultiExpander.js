import {ethers} from 'ethers';

const OP_PATH_START = 1;
const OP_PATH_END = 9;
const OP_PUSH = 3;
const OP_PUSH_OUTPUT = 8;
const OP_PUSH_BYTE = 7;
const OP_SLOT_ADD = 4;
const OP_SLOT_FOLLOW = 5;
const OP_STACK_KECCAK = 6;
const OP_STACK_SLICE = 10;
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
			return this.cache.get(`${target}:${slot}`, () => this.provider.getStorage(this.target, slot, this.block));
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
				targets.set(output.target, bucket);
			}
			output.bucket = bucket;
			output.slots.forEach(x => bucket.set(x, null));
		}
		await Promise.all(Array.from(targets, async ([target, bucket]) => {
			let keys = [...bucket.keys()];
			let proof = await this.provider.send('eth_getProof', [target, keys.map(x => ethers.toBeHex(x)), this.block]);
			bucket.proof = proof.accountProof;
			keys.forEach((key, i) => bucket.set(key, proof.storageProof[i].proof));
		}));
		return outputs.map(output => [output.bucket.proof, output.slots.map(x => output.bucket.get(x))]);
	}
	async eval(ops, inputs) {
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
		while (pos < ops.length) {
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
				case OP_PUSH_BYTE: {
					stack.push(ethers.toBeHex(read_byte(), 32));
					break;
				}
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
				// this is concat(n) + keccak()
				case OP_STACK_KECCAK: {
					let take = read_byte();
					if (take > stack.length) throw Object.assign(new Error('concat overflow'), {stack, take});
					let hash = ethers.keccak256(ethers.concat(await Promise.all(stack.slice(-take))));
					stack.splice(stack.length - take, take, hash);
					break;
				}
				case OP_STACK_SLICE: {
					if (!stack.length) throw new Error('slice stack underflow');
					let x = read_byte();
					let n = read_byte();
					stack[stack.length-1] = ethers.dataSlice(await stack[stack.length-1], x, x + n);
					break;
				}
				default: throw Object.assign(new Error('unknown op'), {op});
			}
		}
		return Promise.all(outputs);
	}
	async read_output(target, slot, step) {
		target = await target;
		if (!target || target.length > 66) throw Object.assign(new Error('invalid target'), {target});
		target = '0x' + target.slice(-40).toLowerCase().padStart(40, '0');
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
		let count = (parseInt(first) - 1) >> 1;
		size = count * step;
		if (size > this.max_bytes) throw Object.assign(new Error('value overflow'), {size, max: this.max_bytes});
		let offset = BigInt(ethers.solidityPackedKeccak256(['uint256'], [slot]));
		let slots = [slot, ...Array.from({length: (size + 31) >> 5}, (_, i) => offset + BigInt(i))];
		const getStorage = this.getStorage.bind(this);
		return {
			target,
			slots,
			value() {
				let p = Promise.all(this.slots.slice(1).map(x => getStorage(target, x))).then(v => {
					return ethers.dataSlice(ethers.concat(v), 0, size);
				});
				this.value = () => p;
				return p;
			}
		};
	}
}
