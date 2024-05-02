import {ethers} from 'ethers';
import {SmartCache} from './SmartCache.js';

// this should mimic GatewayRequest.sol + EVMProofHelper.sol

const MAX_OUTPUTS = 255;
const MAX_INPUTS = 255;

const OP_FOCUS			= 1;
const OP_COLLECT		= 2;
const OP_PUSH			= 10;
const OP_PUSH_OUTPUT	= 11;
//const OP_PUSH_BYTE		= 12;
const OP_SLOT_ADD		= 20;
const OP_SLOT_FOLLOW	= 21;
const OP_STACK_KECCAK	= 30;
const OP_STACK_CONCAT   = 31;
const OP_STACK_SLICE	= 32;

export class GatewayRequest {
	static create(n = 1024) {
		return new this(n);
	}
	constructor(size) {
		this.pos = 1;
		this.buf = new Uint8Array(size); // this is MAX_OPs (this could just grow forever)
		this.inputs = [];
	}
	get ops() {
		return this.buf.slice(0, this.pos);
	}
	_add_op(op) {
		if ((op & 255) !== op) throw Object.assign(new Error('expected byte'), {op});
		let i = this.pos;
		if (i === this.buf.length) throw new Error('op overflow');
		this.buf[i] = op;
		this.pos = i + 1;
	}
	_add_input(v) {
		if (this.inputs.length == MAX_INPUTS) throw new Error('inputs overflow');
		this.inputs.push(ethers.hexlify(v));
		return this.inputs.length-1;
	}
	_add_output() {
		let oi = this.buf[0];
		if (oi == MAX_OUTPUTS) throw new Error('outputs overflow');
		this.buf[0] = oi + 1;
		return oi;
	}
	focus() { this._add_op(OP_FOCUS); }
	collect(step) {
		this._add_op(OP_COLLECT);
		this._add_op(step);
		return this._add_output();
	}
	//push_abi(type, x) { return this.push_bytes(ethers.AbiCoder.defaultAbiCoder().encode([type], [x])); }
	push(x) { this.push_bytes(ethers.toBeHex(x, 32)); }
	push_str(x) { this.push_bytes(ethers.toUtf8Bytes(x)); }
	push_bytes(x) {
		this._add_op(OP_PUSH);
		this._add_op(this._add_input(x));
	}
	output(oi) {
		this._add_op(OP_PUSH_OUTPUT);
		this._add_op(oi);
	}
	slice(x, n) {
		this._add_op(OP_STACK_SLICE);
		this._add_op(x);
		this._add_op(n);
	}
	follow() { this._add_op(OP_SLOT_FOLLOW); }
	add()    { this._add_op(OP_SLOT_ADD); }
	keccak() { this._add_op(OP_STACK_KECCAK); }
	concat() { this._add_op(OP_STACK_CONCAT); }
}

export class MultiExpander {
	async latest(provider) {
		let block = await provider.getBlockNumber();
		return new this(provider, ethers.toBeHex(block));
	}
	constructor(provider, block, cache) {
		this.provider = provider;
		this.block = block;
		this.cache = cache;
		if (cache === undefined) cache = new SmartCache(); // this is probably always worth while (use other falsy to disable)
		this.max_bytes = 1 << 13; // 8KB
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
		// TODO: check eth_getProof limits
		// https://github.com/ethereum/go-ethereum/blob/9f96e07c1cf87fdd4d044f95de9c1b5e0b85b47f/internal/ethapi/api.go#L707 (no limit, just payload size)
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
			let op = ops[pos++];
			try {
				switch (op) {
					case OP_FOCUS: {
						target = pop_stack();
						break;
					}
					case OP_COLLECT: {
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
			throw Object.assign(new Error('output mismatch', {outputs, expected}));
		}
		return Promise.all(outputs);
	}
	async read_output(target, slot, step) {
		target = await target;
		if (!target) throw Object.assign(new Error('invalid target'), {target});
		// the following should be equivalent to: address(uint160(_toUint256(x)))
		target = '0x' + (target.length >= 66 ? target.slice(26, 66) : target.slice(2).padStart(40, '0').slice(-40)).toLowerCase();
		console.log({target, slot, step});
		let first = await this.getStorage(target, slot);
		let size = parseInt(first.slice(64), 16); // last byte
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
		size = (BigInt(first) >> 1n) * BigInt(step); // this could be done with Number()
		if (size > this.max_bytes) throw Object.assign(new Error('dynamic overflow'), {size, max: this.max_bytes});
		size = Number(size);
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
