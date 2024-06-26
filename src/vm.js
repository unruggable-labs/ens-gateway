import {ethers} from 'ethers';
import {CachedMap} from './cached.js';

// this should mimic GatewayRequest.sol + EVMProofHelper.sol

const MAX_OUTPUTS = 255;
const MAX_INPUTS = 255;

const OP_TARGET			= 1;
const OP_TARGET_FIRST	= 2;

const OP_COLLECT		= 5;
const OP_COLLECT_FIRST  = 6;

const OP_PUSH			= 10;
const OP_PUSH_OUTPUT	= 11;
const OP_PUSH_SLOT		= 12;

const OP_SLOT_ADD		= 20;
const OP_SLOT_FOLLOW	= 21;
const OP_SLOT_SET		= 22;

const OP_STACK_KECCAK	= 30;
const OP_STACK_CONCAT   = 31;
const OP_STACK_SLICE	= 32;
const OP_STACK_FIRST	= 33;

export const GATEWAY_ABI = new ethers.Interface([
	// v1
	`function getStorageSlots(address addr, bytes32[] memory commands, bytes[] memory constants) external pure returns(bytes memory witness)`,
	// v2
	`function fetch(bytes context, tuple(bytes ops, bytes[] inputs) request) returns (bytes memory)`
]);

function uint256_from_bytes(hex) {
	// the following should be equivalent to EVMProofHelper._toUint256()
	return hex === '0x' ? 0n : BigInt(hex.slice(0, 66));
}
function address_from_bytes(hex) {
	// the following should be equivalent to: address(uint160(_toUint256(x)))
	return '0x' + (hex.length >= 66 ? hex.slice(26, 66) : hex.slice(2).padStart(40, '0').slice(-40)).toLowerCase();
}

export class EVMRequestV1 {
	constructor(target = ethers.ZeroAddress, commands = [], constants = []) {
		this.target = target;
		this.commands = commands;
		this.constants = constants;
		this.buf = [];
	}
	_add(x) {
		if (this.constants.length >= 32) throw new Error('constants overflow');
		this.constants.push(ethers.hexlify(x));
		return this.constants.length-1;
	}
	_start(flags, slot) {
		this.end();
		this.buf.push(flags, this._add(ethers.toBeHex(slot, 32)));
		return this;
	}
	end() {
		let {buf} = this;
		if (!buf.length) return;
		if (buf.length < 32 && buf[buf.length-1] != 0xFF) buf.push(0xFF);
		let word = new Uint8Array(32);
		word.set(buf);
		this.commands.push(ethers.hexlify(word));
		buf.length = 0;
	}
	getStatic(slot)  { return this._start(0, slot); }
	getDynamic(slot) { return this._start(1, slot); }
	ref(i) {
		this.buf.push((1 << 5) | i);
		return this;
	}
	element(x) { return this.element_bytes(ethers.toBeHex(x, 32)); }
	element_str(s) { return this.element_bytes(ethers.toUtf8Bytes(s)); }
	element_bytes(x) {
		this.buf.push(this._add(x));
		return this;
	}
	encode() {
		this.end();
		return GATEWAY_ABI.encodeFunctionData('getStorageSlots', [this.target, this.commands, this.constants]);
	}
	v2() {
		this.end();
		let req = new EVMRequest();
		req.push(this.target);
		req.target();
		for (let cmd of this.commands) {
			try {
				let v = ethers.getBytes(cmd);
				req.push(this.constants[v[1]]); //first constant is the base slot
				req.add();
				for (let i = 2; i < v.length; i++) {
					let op = v[i];
					if (op === 0xFF) break;
					let operand = op & 0x1F;
					switch (op >> 5) {
						case 0: { // OP_CONSTANT
							req.push_bytes(this.constants[operand]);
							req.follow();
							continue;
						}
						case 1: { // OP_BACKREF
							req.push_output(operand);
							req.follow();
							continue;
						}
						default: throw new Error(`unknown op: ${op}`);
					}
				}
				req.collect(v[0] & 1);
			} catch (err) {
				Object.assign(err, {cmd});
				throw err;
			}
		}
		return req;
	}
}

export class EVMRequest {
	static decode(data) {
		let [context, [ops, inputs]] = GATEWAY_ABI.decodeFunctionData('fetch', data);
		ops = ethers.getBytes(ops);
		let r = new this(ops, inputs, ops.length);
		r.context = context;
		return r;
	}
	constructor(buf, inputs = [], pos = 1) {
		if (!buf) buf = 1024;
		if (Number.isInteger(buf)) buf = new Uint8Array(buf);
		this.buf = buf;
		this.pos = pos;
		this.inputs = inputs;
	}
	encode(context) {
		return GATEWAY_ABI.encodeFunctionData('fetch', [context ?? this.context ?? '0x', [this.ops, this.inputs]]);
	}
	get ops() {
		return this.buf.slice(0, this.pos);
	}
	_add_op(op) {
		if ((op & 0xFF) !== op) throw Object.assign(new Error('expected byte'), {op});
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
	target() { this._add_op(OP_TARGET); }
	target_first() { this._add_op(OP_TARGET_FIRST); }
	collect(step) {
		this._add_op(OP_COLLECT);
		this._add_op(step);
		return this._add_output();
	}
	collect_first(step) {
		this._add_op(OP_COLLECT_FIRST);
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
	push_slot() { this._add_op(OP_PUSH_SLOT); }
	push_output(oi) {
		this._add_op(OP_PUSH_OUTPUT);
		this._add_op(oi);
	}
	slice(x, n) {
		this._add_op(OP_STACK_SLICE);
		this._add_op(x);
		this._add_op(n);
	}
	concat(n) { 
		this._add_op(OP_STACK_CONCAT); 
		this._add_op(n);
	}
	follow() { this._add_op(OP_SLOT_FOLLOW); }
	add()    { this._add_op(OP_SLOT_ADD); }
	set()    { this._add_op(OP_SLOT_SET); }
	keccak() { this._add_op(OP_STACK_KECCAK); }
	first()  { this._add_op(OP_STACK_FIRST); }
}

export class EVMProver {
	static async latest(provider) {
		let block = await provider.getBlockNumber();
		return new this(provider, ethers.toBeHex(block));
	}
	static async resolved(outputs) {
		// fully resolve and unwrap the values
		return Promise.all(outputs.map(async x => {
			x.value = await x.value();
			return x;
		}));
	}
	constructor(provider, block, cache) {
		this.provider = provider;
		this.block = block;
		this.cache = cache || new CachedMap();
		this.max_bytes = 1 << 13; // 8KB
	}
	async getBlock() {
		return this.cache.get('BLOCK', () => this.provider.getBlock(this.block));
	}
	async getExists(target) {
		// assuming this is cheaper than eth_getProof with 0 slots
		// why isn't there eth_getCodehash?
		return this.cache.get(target, t => this.provider.getCode(t, this.block).then(x => x.length > 2));
	}
	async getStorage(target, slot) {
		slot = ethers.toBeHex(slot);
		return this.cache.get(`${target}:${slot}`, async () => {
			let value = await this.provider.getStorage(target, slot, this.block)
			if (value !== ethers.ZeroHash) {
				// any nonzero slot => code exists => contract => non-null storage trie
				this.cache.add(target, true);
			}
			return value;
		});
	}
	async prove(outputs) {
		let targets = new Map();
		let buckets = outputs.map(output => {
			let bucket = targets.get(output.target);
			if (!bucket) {
				bucket = new Map();
				bucket.index = targets.size;
				targets.set(output.target, bucket);
			}
			output.slots.forEach(x => bucket.set(x, null));
			return bucket;
		});
		// TODO: check eth_getProof limits
		// https://github.com/ethereum/go-ethereum/blob/9f96e07c1cf87fdd4d044f95de9c1b5e0b85b47f/internal/ethapi/api.go#L707 
		// 20240501: no limit, just response size
		await Promise.all(Array.from(targets, async ([target, bucket]) => {
			let slots = [...bucket.keys()];
			let proof = await this.provider.send('eth_getProof', [target, slots.map(x => ethers.toBeHex(x, 32)), this.block]);
			bucket.proof = proof.accountProof;
			slots.forEach((key, i) => bucket.set(key, proof.storageProof[i].proof));
		}));
		return [
			Array.from(targets.values(), x => x.proof),
			outputs.map((output, i) => {
				let bucket = buckets[i];
				return [bucket.index, output.slots.map(x => bucket.get(x))];
			})
		];
		//return outputs.map(output => [output.bucket.proof, output.slots.map(x => output.bucket.get(x))]);
	}
	async eval(ops, inputs) {
		//console.log({ops, inputs});
		let pos = 1; // skip # outputs
		let slot = 0n;
		let target = '0x';
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
		//const expected = read_byte();
		outer: while (pos < ops.length) {
			let op = read_byte();
			try {
				switch (op) {
					case OP_TARGET: {
						target = address_from_bytes(await pop_stack());
						slot = 0n;
						break;
					}
					case OP_TARGET_FIRST: {
						let exists;
						while (stack.length && !exists) {
							target = address_from_bytes(await pop_stack());
							outputs.push({
								target, 
								slots: [], 
								value() { return null; }
							});
							exists = await this.getExists(target);
						}
						if (!exists) break outer;
						stack.length = 0;
						slot = 0n;
						break;
					}
					case OP_COLLECT: {
						let step = read_byte();
						outputs.push(this.read_output(target, slot, step));
						slot = 0n;
						break;
					}
					case OP_COLLECT_FIRST: {
						let step = read_byte();
						while (stack.length) { // TODO: make this parallel or batched?
							let output = await this.read_output(target, uint256_from_bytes(await pop_stack()), step);
							outputs.push(output);
							if (step == 0 ? uint256_from_bytes(await output.value()) : output.size) break;
						}
						stack.length = 0;
						slot = 0n;
						break;
					}
					case OP_PUSH: { 
						stack.push(inputs[read_byte()]);
						break;
					}
					case OP_PUSH_OUTPUT: {
						stack.push(Promise.resolve(outputs[read_byte()]).then(x => x.value()));
						break;
					}
					case OP_PUSH_SLOT: {
						stack.push(ethers.toBeHex(slot, 32));
						break;
					}
					case OP_SLOT_ADD: {
						slot += uint256_from_bytes(await pop_stack());
						break;
					}
					case OP_SLOT_SET: {
						slot = uint256_from_bytes(await pop_stack());
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
						let n = read_byte();
						stack.splice(Math.max(0, stack.length-n), n, n ? ethers.concat(await Promise.all(stack.slice(-n))) : '0x');
						break;
					}
					case OP_STACK_SLICE: {
						let x = read_byte();
						let n = read_byte();
						stack.push(ethers.dataSlice(await pop_stack(), x, x + n));
						break;
					}
					case OP_STACK_FIRST: {
						let first = '0x';
						while (stack.length) {
							let v = await pop_stack();
							if (!/^0x0*$/.test(v)) {
								first = v;
								break;
							}
						}
						stack.length = 0;
						stack.push(first);
						break;
					}
					default: throw new Error('unknown op');
				}
			} catch (err) {
				Object.assign(err, {ops, inputs, state: {op, pos, target, slot, stack}});
				throw err;
			}
		}
		// this is no longer true with _FIRST ops
		// nor is this true if we allow early termination 
		// if (outputs.length != expected) {
		// 	throw Object.assign(new Error('output mismatch', {outputs, expected}));
		// }
		return Promise.all(outputs);
	}
	async read_output(target, slot, step) {
		//console.log({target, slot, step});
		//if (step === undefined) return {target, slots: [], value}
		let first = await this.getStorage(target, slot);
		let size = parseInt(first.slice(64), 16); // last byte
		if (step == 0) { // bytes32
			let p = Promise.resolve(first);
			return {
				target,
				size: size > 0 ? 32 : 0, // size is falsy on zero 
				slots: [slot],
				value: () => p
			};
		} else if (step == 1 && !(size & 1)) { // small bytes
			size >>= 1;
			let p = Promise.resolve(ethers.dataSlice(first, 0, size));
			return {
				target,
				size,
				slots: [slot],
				value: () => p
			};
		}
		size = (BigInt(first) >> 1n) * BigInt(step); // this could be done with Number()
		if (size > this.max_bytes) throw Object.assign(new Error('dynamic overflow'), {size, max: this.max_bytes});
		size = Number(size);
		let offset = BigInt(ethers.solidityPackedKeccak256(['uint256'], [slot]));
		let slots = [slot, ...Array.from({length: (size + 31) >> 5}, (_, i) => offset + BigInt(i))];
		return {
			parent: this,
			target,
			slots,
			size,
			value() {
				let p = Promise.all(this.slots.slice(1).map(x => this.parent.getStorage(this.target, x))).then(v => {
					return ethers.dataSlice(ethers.concat(v), 0, size);
				});
				this.value = () => p;
				return p;
			}
		};
	}
}
