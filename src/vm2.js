import {ethers} from 'ethers';
import {unwrap, Wrapped} from './wrap.js';
import {CachedMap} from './cached.js';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

const OP_DEBUG = 255;
const OP_TARGET = 1;
const OP_SET_OUTPUT = 2;
const OP_EVAL = 3;

const OP_REQ_NONZERO = 10;
const OP_REQ_TARGET = 11;

const OP_READ_SLOTS = 20;
const OP_READ_BYTES = 21;
const OP_READ_ARRAY = 22;

const OP_SLOT_ZERO = 30;
const OP_SLOT_ADD = 31;
const OP_SLOT_FOLLOW = 32;

const OP_PUSH_INPUT = 40;
const OP_PUSH_OUTPUT = 41;
const OP_PUSH_SLOT = 42;
const OP_PUSH_TARGET = 43;

const OP_DUP = 50;
const OP_POP = 51;

const OP_KECCAK = 60;
const OP_CONCAT = 61;
const OP_SLICE = 62;

function uint256FromHex(hex) {
	// the following should be equivalent to EVMProofHelper.toUint256()
	return hex === '0x' ? 0n : BigInt(hex.slice(0, 66));
}
function addressFromHex(hex) {
	// the following should be equivalent to: address(uint160(_toUint256(x)))
	return '0x' + (hex.length >= 66 ? hex.slice(26, 66) : hex.slice(2).padStart(40, '0').slice(-40)).toLowerCase();
}
function bigintRange(start, length) {
	return Array.from({length}, (_, i) => start + BigInt(i));
}
function solidityArraySlots(slot, length) {
	return length ? bigintRange(BigInt(ethers.solidityPackedKeccak256(['uint256'], [slot])), length) : [];
}

export class EVMCommandReader {
	static fromCommand(cmd) {
		return new this(Uint8Array.from(cmd.ops), [...cmd.inputs]);
	}
	static fromEncoded(hex) {
		let [ops, inputs] = ABI_CODER.decode(['bytes', 'bytes[]'], hex);
		return new this(ethers.getBytes(ops), [...inputs]);
	}
	constructor(ops, inputs) {
		this.pos = 0;
		this.ops = ops;
		this.inputs = inputs;
	}
	get remaining() {
		return this.ops.length - this.pos;
	}
	readByte() {
		let b = this.ops[this.pos++];
		if (this.pos > this.ops.length) throw new Error('reader overflow');
		return b;
	}
	readInput() {
		let i = this.readByte();
		if (i >= this.inputs.length) throw new Error(`invalid input index: ${i}`);
		return this.inputs[i];
	}
}

const BIT_STOP_ON_SUCCESS = 1;
const BIT_STOP_ON_FAILURE = 2;
const BIT_ACQUIRE_STATE = 4;

export class EVMCommand {
	constructor(parent) {
		this.parent = parent;
		this.ops = [];
		this.inputs = [];
	}
	addByte(x) {
		if ((x & 255) !== x) throw new Error(`expected byte: ${x}`);
		this.ops.push(x);
		return this;
	}
	addInputStr(s) { return this.addInputBytes(ethers.toUtf8Bytes(s)); }
	addInputBytes(v) {
		let hex = ethers.hexlify(v);
		let i = this.inputs.length;
		this.inputs.push(hex);
		return i;
	}
	encode() {
		return ABI_CODER.encode(['bytes', 'bytes[]'], [Uint8Array.from(this.ops), this.inputs]);
	}
	debug(label = '') { return this.addByte(OP_DEBUG).addByte(this.addInputStr(label)); }

	read(n = 1) { return this.addByte(OP_READ_SLOTS).addByte(n); }
	readBytes() { return this.addByte(OP_READ_BYTES); }
	readArray(step) { return this.addByte(OP_READ_ARRAY).addByte(step); }

	pop() { return this.addByte(OP_POP); }
	setOutput(i) { return this.addByte(OP_SET_OUTPUT).addByte(i); }

	zeroSlot() { return this.addByte(OP_SLOT_ZERO); }
	addSlot() { return this.addByte(OP_SLOT_ADD); }
	offset(x) { return this.push(x).addSlot(); }

	setTarget() { return this.addByte(OP_TARGET); }
	requireContract() { return this.addByte(OP_REQ_TARGET); }
	requireNonzero(back = 0) { return this.addByte(OP_REQ_NONZERO).addByte(back); }

	pop() { return this.addByte(OP_POP); }
	dup(back = 0) { return this.addByte(OP_DUP).addByte(back); }
	pushOutput(i) { return this.addByte(OP_PUSH_OUTPUT).addByte(i); }
	pushInput(i) { return this.addByte(OP_PUSH_INPUT).addByte(i); }
	push(x) { return this.pushBytes(ethers.toBeHex(x, 32)); }
	pushStr(s) { return this.addByte(OP_PUSH_INPUT).addByte(this.addInputStr(s)); }
	pushBytes(v) { return this.addByte(OP_PUSH_INPUT).addByte(this.addInputBytes(v)); }
	eval({success, failure, acquire, back = 255} = {}) {
		let flags = 0;
		if (success) flags |= BIT_STOP_ON_SUCCESS;
		if (failure) flags |= BIT_STOP_ON_FAILURE;
		if (acquire) flags |= BIT_ACQUIRE_STATE;
		return this.addByte(OP_EVAL).addByte(back).addByte(flags);
	}
	concat(n) { return this.addByte(OP_CONCAT).addByte(n); }
	keccak() { return this.addByte(OP_KECCAK); }
	follow() { return this.addByte(OP_SLOT_FOLLOW); }
	slice(x, n) { this.addByte(OP_SLICE).addByte(x).addByte(n); }
		
	begin() { return new EVMCommand(this); }
	end() {
		let p = this.parent;
		if (!p) throw new Error('no parent');
		this.parent = undefined;
		p.pushBytes(this.encode());
		return p;
	}
}

export class EVMRequest extends EVMCommand {
	constructor(outputs = 0) {
		super(undefined);
		this.context = undefined;
		this.addByte(outputs);
	}
}

class EvalContext {
	constructor() {
		this.target = ethers.ZeroAddress;
		this.slot = 0n;
		this.stack = [];
		this.exitCode = 0;
	}
	pop() {
		if (!this.stack.length) throw new Error('stack: underflow');
		return this.stack.pop();
	}
	popSlice(back) {
		return back > 0 ? this.stack.splice(-back) : [];
	}
	peek(back) {
		if (back >= this.stack.length) throw new Error('stack: overflow');
		return this.stack[this.stack.length-1-back]; // from end
	}
}

export class EVMProver {
	static async latest(provider) {
		let block = await provider.getBlockNumber(); 
		return new this(provider, ethers.toBeHex(block));
	}
	constructor(provider, block, cache) {
		this.provider = provider;
		this.block = block;
		this.cache = cache ?? new CachedMap();
		this.outputs = [];
		this.needs = [];
	}
	async getOutputs() {
		return Promise.all(this.outputs.map(unwrap));
	}
	checkOutputIndex(i) {
		if (i >= this.outputs.length) throw new Error(`invalid output: ${i}`);
		return i;
	}
	checkSize(size) {
		const maxBytes = 1000;
		if (size > maxBytes) throw Object.assign(new Error('overflow: size'), {size, max: maxBytes});
		return Number(size);
	}
	async proveStorage(target, slot) {
		this.needs.push([target, slot]);
		return this.getStorage(target, slot);
	}
	async getStorage(target, slot) {
		return this.cache.get(`${target}:${slot}`, () => this.provider.getStorage(target, slot, this.block));
	}
	async getCode(target) {
		return this.cache.get(target, () => this.provider.getCode(target, this.block));
	}
	async prove() {
		let targets = new Map();
		let refs = [];
		let order = this.needs.map(([target, slot]) => {
			let bucket = targets.get(target);
			if (slot >= 0) {
				let ref = bucket.get(slot);
				if (!ref) {
					ref = {id: refs.length};
					refs.push(ref);
					bucket.set(slot, ref);
				}
				return ref.id;
			} else {
				if (!bucket) {
					bucket = new Map();
					bucket.id = refs.length;
					refs.push(bucket);
					targets.set(target, bucket);
				}
				return bucket.id;
			}
		});
		await Promise.all(Array.from(targets, async ([target, bucket]) => {
			let proof = await this.provider.send('eth_getProof', [target, Array.from(bucket.keys(), x => ethers.toBeHex(x, 32)), this.block]);
			bucket.proof = proof.accountProof;
			Array.from(bucket.values(), (ref, i) => ref.proof = proof.storageProof[i].proof);
		}));
		return {
			proofs: refs.map(x => x.proof),
			order
		};
	}
	async evalDecoded(ops, inputs) {
		return this.evalReader(new EVMCommandReader(ethers.getBytes(ops), inputs));
	}
	async evalRequest(req) {
		return this.evalReader(EVMCommandReader.fromCommand(req));
	}
	async evalReader(reader) {
		this.needs = [];
		this.outputs = Array.from({length: reader.readByte()}, () => '0x');
		let ctx = new EvalContext();
		await this.evalCommand(reader, ctx);
		return ctx;
	}
	async evalCommand(reader, ctx) {
		outer: while (reader.remaining) {
			let op = reader.readByte();
			switch (op) {
				case OP_DEBUG: {
					console.log('DEBUG', ethers.toUtf8String(reader.readInput()), {
						target: ctx.target,
						slot: ctx.slot,
						return: ctx.returnValue,
						stack: await Promise.all(ctx.stack.map(unwrap)),
						outputs: await Promise.all(this.outputs)
					});
					break;
				}
				case OP_TARGET: {
					ctx.target = addressFromHex(await unwrap(ctx.pop()));
					ctx.slot = 0n;
					this.needs.push([ctx.target, -1n]);
					continue;
				}
				case OP_SLOT_ADD: {
					ctx.slot += uint256FromHex(await unwrap(ctx.pop()));
					continue;
				}
				case OP_SLOT_ZERO: {
					ctx.slot = 0n;
					continue;
				}
				case OP_SET_OUTPUT: {
					this.outputs[this.checkOutputIndex(reader.readByte())] = ctx.pop();
					continue;
				}
				case OP_PUSH_INPUT: {
					ctx.stack.push(reader.readInput());
					continue;
				}
				case OP_PUSH_OUTPUT: {
					ctx.stack.push(this.outputs[this.checkOutputIndex(reader.readByte())]);
					continue;
				}
				case OP_PUSH_SLOT: {
					ctx.stack.push(ethers.toBeHex(ctx.slot, 32));
					break;
				}
				case OP_PUSH_TARGET: {
					ctx.stack.push(ctx.target);
					break;
				}
				case OP_DUP: {
					ctx.stack.push(ctx.peek(reader.readByte()));
					continue;
				}	
				case OP_POP: {
					ctx.pop();
					continue;
				}				
				case OP_READ_SLOTS: {
					let length = reader.readByte();
					if (!length) throw new Error(`empty read`);
					let {target, slot} = ctx;
					let slots = bigintRange(slot, length);
					slots.forEach(slot => this.needs.push([target, slot]));
					ctx.stack.push(new Wrapped(async () => ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x))))));
					continue;
				}
				// case OP_READ: {
				// 	let {target, slot} = ctx;
				// 	ctx.stack.push(wrap(async () => this.proveStorage(target, slot)));
				// 	continue;
				// }
				// case OP_READ_SPAN: {
				// 	let length = reader.readByte();
				// 	let {target, slot} = ctx;
				// 	let slots = Array.from({length}, (_, i) => slot + BigInt(i));
				// 	this.needs.push(...slots.map(x => [target, x]));
				// 	ctx.stack.push(wrap(async () => ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x))))));
				// 	continue;
				// }
				case OP_READ_BYTES: {
					let {target, slot} = ctx;
					let first = await this.proveStorage(target, slot);
					let size = parseInt(first.slice(64), 16); // last byte
					if ((size & 1) == 0) { // small
						ctx.stack.push(ethers.dataSlice(first, 0, size >> 1));
					} else {
						size = this.checkSize(BigInt(first) >> 1n);
						let slots = solidityArraySlots(slot, (size + 31) >> 5);
						slots.forEach(slot => this.needs.push([target, slot]));
						ctx.stack.push(new Wrapped(async () => ethers.dataSlice(ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x)))), 0, size)));
					}
					continue;
				}
				case OP_READ_ARRAY: {
					let step = reader.readByte();
					if (!step) throw new Error('invalid element size');
					let {target, slot} = ctx;
					let length = this.checkSize(uint256FromHex(await this.proveStorage(target, slot)));
					if (step < 32) {
						let per = 32 / step|0;
						length = (length + per - 1) / per|0;
					} else {
						length = length * ((step + 31) >> 5);
					}
					let slots = [slot, ...solidityArraySlots(slot, length)];
					slots.forEach(slot => this.needs.push([target, slot]));
					ctx.stack.push(new Wrapped(async () => ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x))))));
					continue;
				}
				case OP_REQ_TARGET: {
					let code = await this.getCode(ctx.target);
					//this.needs.push([ctx.target, -1n]);
					if (code.length <= 2) {
						ctx.exitCode = 1;
						return;
					}
					continue;
				}
				case OP_REQ_NONZERO: {
					let back = reader.readByte();
					if (/^0x0*$/.test(await unwrap(ctx.peek(back)))) {
						ctx.exitCode = 1;
						return;
					}
					continue;
				}
				case OP_EVAL: {
					let back = reader.readByte();
					let flags = reader.readByte();
					let cmd = EVMCommandReader.fromEncoded(await unwrap(ctx.pop()));
					let args = ctx.popSlice(back).toReversed();
					let sub = new EvalContext();
					for (let arg of args) {
						sub.target = ctx.target;
						sub.slot = ctx.slot;
						sub.stack = [arg];
						cmd.pos = 0;
						await this.evalCommand(cmd, sub);
						if (flags & (sub.exitCode ? BIT_STOP_ON_FAILURE : BIT_STOP_ON_SUCCESS)) break;
					}
					if (flags & BIT_ACQUIRE_STATE) {
						ctx.target = sub.target;
						ctx.slot   = sub.slot;
						ctx.stack  = sub.stack;
					}
					continue;
				}
				case OP_SLOT_FOLLOW: {
					ctx.slot = BigInt(ethers.keccak256(ethers.concat([await unwrap(ctx.pop()), ethers.toBeHex(ctx.slot, 32)])));
					continue;
				}
				case OP_KECCAK: {
					ctx.stack.push(ethers.keccak256(await unwrap(ctx.pop())));
					continue;
				}
				case OP_CONCAT: {
					let v = ctx.popSlice(reader.readByte());
					ctx.stack.push(v.length ? new Wrapped(async () => ethers.concat(await Promise.all(v.map(unwrap)))) : '0x');
					continue;
				}
				default: throw new Error(`unknown op: ${op}`);
			}
		}
		return ctx;
	}

}