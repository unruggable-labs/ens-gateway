import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import assert from 'node:assert/strict';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

const OP_PUSH = 1;
//const OP_EVAL_INLINE = 2;
const OP_TARGET_SET = 3;
const OP_EVAL = 4;
const OP_REQ_NONZERO = 5;
const OP_REQ_TARGET_IS_CODE = 6;
const OP_READ_SLOTS = 7;
const OP_READ_BYTES = 8;
//const OP_READ_SPAN = 9;
const OP_PUSH_OUTPUT = 10;
const OP_READ_ARRAY = 11;
const OP_SLOT_ADD = 12;
const OP_FOLLOW = 13;
const OP_SET_OUTPUT = 14;
const OP_CONCAT = 15;
const OP_KECCAK = 16;
const OP_SLOT_SET = 17;
const OP_PUSH_STACK = 18;
//const OP_EVAL_ALL = 19;
const OP_DEBUG = 20;


// const OUT_TARGET = 0;
// const OUT_SLOT = 1;

function uint256FromHex(hex) {
	// the following should be equivalent to EVMProofHelper.toUint256()
	return hex === '0x' ? 0n : BigInt(hex.slice(0, 66));
}
function addressFromHex(hex) {
	// the following should be equivalent to: address(uint160(_toUint256(x)))
	return '0x' + (hex.length >= 66 ? hex.slice(26, 66) : hex.slice(2).padStart(40, '0').slice(-40)).toLowerCase();
}

class EVMCommandReader {
	static fromRequest(req) {
		return new this(Uint8Array.from(req.ops), [...req.inputs]);
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
}

class EVMCommand {
	// static decode(v) {
	// 	let cmd = new this();
	// 	let [ops, inputs] = ABI_CODER.decode(['bytes', 'bytes[]'], v);
	// 	cmd.ops.push(...ops);
	// 	cmd.inputs.push(...inputs);
	// 	return cmd;
	// }
	constructor() {
		this.ops = [];
		this.inputs = [];
	}
	addByte(x) {
		if ((x & 255) !== x) throw new Error(`expected byte: ${x}`);
		this.ops.push(x);
		return this;
	}
	encode() {
		return ABI_CODER.encode(['bytes', 'bytes[]'], [Uint8Array.from(this.ops), this.inputs]);
	}
	debug() { return this.addByte(OP_DEBUG); }

	read(n = 1) { return this.addByte(OP_READ_SLOTS).addByte(n); }
	readBytes() { return this.addByte(OP_READ_BYTES); }
	readArray(step) { return this.addByte(OP_READ_ARRAY).addByte(step); }

	setOutput(i) { return this.addByte(OP_SET_OUTPUT).addByte(i); }

	setSlot() { return this.addByte(OP_SLOT_SET); }
	addSlot() { return this.addByte(OP_SLOT_ADD); }
	offset(x) { return this.push(x).addSlot(); }

	setTarget() { return this.addByte(OP_TARGET_SET); }
	requireContract() { return this.addByte(OP_REQ_TARGET_IS_CODE); }
	requireNonzero() { return this.addByte(OP_REQ_NONZERO); }
	dup(back = 0) { return this.addByte(OP_PUSH_STACK).addByte(back); }
	pushOutput(i) { return this.addByte(OP_PUSH_OUTPUT).addByte(i); }
	push(x) { return this.pushBytes(x instanceof EVMCommand ? x.encode() : ethers.toBeHex(x, 32)); }
	pushStr(s) { return this.pushBytes(ethers.toUtf8Bytes(s)); }
	pushBytes(v) {
		let hex = ethers.hexlify(v);
		this.addByte(OP_PUSH);
		this.addByte(this.inputs.length);
		this.inputs.push(hex);
		return this;
	}
	eval(ok, err) { return this.addByte(OP_EVAL).addByte((ok ? 1 : 0) | (err ? 2 : 0)); }
	//inlineEval(v) { return this.addByte(OP_EVAL_INLINE).pushBytes(ABI_CODER.encode(['bytes'], [v.map(r => r.encode())])); }
	concat(n) { return this.addByte(OP_CONCAT).addByte(n); }
	keccak() { return this.addByte(OP_KECCAK); }
	follow() { return this.addByte(OP_FOLLOW); }
}

class EVMRequest extends EVMCommand {
	constructor(outputs = 0) {
		super();
		this.outputs = outputs;
		this.context = undefined;
	}
}

function wrap(x) {
	return {
		init: x,
		value: undefined,
		get() {
			if (!this.value) {
				this.value = this.init();
				this.init = undefined;
			}
			return this.value;
		}
	};
}
async function unwrap(x) {
	return typeof x === 'string' ? x : x.get();
}

class Context {
	constructor() {
		this.target = ethers.ZeroAddress;
		this.slot = 0n;
		this.stack = [];
		this.returnValue = 0;
	}
	requireStack() {
		if (!this.stack.length) throw new Error('stack: underflow');
	}
	pop() {
		this.requireStack();
		return this.stack.pop();
	}
	peek(back) {
		if (back >= this.stack.length) throw new Error('stack: overflow');
		return this.stack[this.stack.length-1-back]; // from end
	}
	async resolveTarget() {
		return this.target = addressFromHex(await unwrap(this.target));
	}
}

function solidityArraySlots(slot, length) {
	if (!length) return [];
	let start = BigInt(ethers.solidityPackedKeccak256(['uint256'], [slot]));
	return Array.from({length}, (_, i) => start + BigInt(i));
}


class EVMProver {
	static async latest(provider) {
		let block = await provider.getBlockNumber(); 
		return new this(provider, ethers.toBeHex(block));
	}
	constructor(provider, block) {
		this.provider = provider;
		this.block = block;
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
	// async resolveTargetSlot() {
	// 	let [target, slot] = await Promise.all([OUT_TARGET, OUT_SLOT].map(x => this.realizeOutput(x)));
	// 	return [addressFromHex(target), uint256FromHex(slot)];
	// }
	async proveStorage(target, slot) {
		this.needs.push([target, slot]);
		return this.getStorage(target, slot);
	}
	async getStorage(target, slot) {
		console.log('getStorage', target, slot);
		return this.provider.getStorage(target, slot, this.block);
	}
	async eval(req) {
		this.needs = [];
		this.outputs = Array.from({length: req.outputs}, () => '0x');
		let ctx = new Context();
		await this.evalCommand(EVMCommandReader.fromRequest(req), ctx);		
		return ctx;
	}
	async evalCommand(reader, ctx) {
		outer: while (reader.remaining) {
			let op = reader.readByte();
			switch (op) {
				case OP_DEBUG: {
					console.log('DEBUG', ctx);
					break;
				}
				case OP_TARGET_SET: {
					ctx.target = addressFromHex(await unwrap(ctx.pop()));
					ctx.slot = 0n;
					continue;
				}
				case OP_SLOT_ADD: {
					ctx.slot += uint256FromHex(await unwrap(ctx.pop()));
					continue;
				}
				case OP_SLOT_SET: {
					ctx.slot = uint256FromHex(await unwrap(ctx.pop()));
					continue;
				}
				case OP_SET_OUTPUT: {
					this.outputs[this.checkOutputIndex(reader.readByte())] = ctx.pop();
					continue;
				}
				case OP_PUSH: {
					let i = reader.readByte();
					if (i >= reader.inputs.length) throw new Error('wtf');
					ctx.stack.push(reader.inputs[i]);
					continue;
				}
				case OP_PUSH_STACK: {
					ctx.stack.push(ctx.peek(reader.readByte()));
					continue;
				}	
				case OP_PUSH_OUTPUT: {
					ctx.stack.push(this.outputs[this.checkOutputIndex(reader.readByte())]);
					continue;
				}
				case OP_READ_SLOTS: {
					let length = reader.readByte();
					if (!length) throw new Error(`empty read`);
					let {target, slot} = ctx;
					let slots = Array.from({length}, (_, i) => slot + BigInt(i));
					this.needs.push(...slots.map(x => [target, x]));
					ctx.stack.push(wrap(async () => ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x))))));
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
						this.needs.push(...slots.map(x => [target, x]));
						ctx.stack.push(wrap(async () => ethers.dataSlice(ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x)))), 0, size)));
					}
					continue;
				}
				case OP_READ_ARRAY: {
					let step = reader.readByte();
					if (!step) throw new Error('invalid element size'); // ?
					let {target, slot} = ctx;
					let length = this.checkSize(uint256FromHex(await this.proveStorage(target, slot)));
					if (step < 32) {
						let per = 32 / step|0;
						length = (length + per - 1) / per|0;
					} else {
						length = length * ((step + 31) >> 5);
					}
					let slots = [slot, ...solidityArraySlots(slot, length)];
					this.needs.push(...slots.map(x => [target, x]));
					ctx.stack.push(wrap(async () => ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x))))));
					continue;
				}
				case OP_REQ_TARGET_IS_CODE: {
					let code = await this.provider.getCode(ctx.target);
					console.log('getCode', ctx.target);
					this.needs.push([ctx.target]);
					if (code.length <= 2) {
						ctx.returnValue = 1;
						return;
					}
					continue;
				}
				case OP_REQ_NONZERO: {
					//if (/^0x0*$/.test(await unwrap(ctx.peek(0)))) {
					if (/^0x0*$/.test(await unwrap(ctx.pop()))) {
						ctx.returnValue = 1;
						return;
					}
					continue;
				}
				// case OP_EVAL_INLINE: {
				// 	for (let hex of ABI_CODER.decode(['bytes[]'], await unwrap(ctx.pop()))) {
				// 		let subctx = new Context();
				// 		await this.evalCommand(EVMCommandReader.fromEncoded(hex), subctx);
				// 		if (subctx.ok) {
				// 			continue outer;
				// 		}
				// 	}
				// 	ctx.ok = false;
				// 	break;
				// }
				case OP_EVAL: {
					let flags = reader.readByte();
					let temp = new Context();
					while (ctx.stack.length) {
						temp.target = ctx.target;
						temp.slot = ctx.slot;
						temp.stack.length = 0;
						await this.evalCommand(EVMCommandReader.fromEncoded(await unwrap(ctx.pop())), temp);
						if (flags & (temp.returnValue ? 1 : 2)) {
							//if (temp.ok) {
							ctx.target = temp.target;
							ctx.slot   = temp.slot;
							ctx.stack  = temp.stack;
							///}
							break;
						}
					}
					//ctx.ok = false;
					//break;
					continue;
				}
				// case OP_EVAL_ALL: {
				// 	while (ctx.stack.length) {
				// 		await this.evalCommand(EVMCommandReader.fromEncoded(await unwrap(ctx.pop())), new Context());
				// 	}
				// 	continue;
				// }
				case OP_FOLLOW: {
					ctx.slot = BigInt(ethers.keccak256(ethers.concat([await unwrap(ctx.pop()), ethers.toBeHex(ctx.slot, 32)])));
					continue;
				}
				case OP_KECCAK: {
					ctx.stack.push(ethers.keccak256(await unwrap(ctx.pop())));
					continue;
				}
				case OP_CONCAT: {
					let n = reader.readByte();
					ctx.stack.splice(Math.max(0, ctx.stack.length-n), n, n ? ethers.concat(await Promise.all(ctx.stack.slice(-n).map(unwrap))) : '0x');
					continue;
				}
				default: throw new Error(`unknown op: ${op}`);
			}
		}
		return ctx;
	}

}


let foundry = await Foundry.launch();

const STR_SHORT = 'Chonk';
const STR_LONG = 'Abc'.repeat(17);

let test = await foundry.deploy({sol: `
	contract Test {
		uint256 slot0 = 1;
		uint256 slot1 = 2;
		string slot2 = '${STR_SHORT}';
		string slot3 = '${STR_LONG}';
		uint48[] slot4 = [1, 2, 3, 4, 5, 6]; // 256/48 = 5
		struct S {
			uint256 num;
			string str;
			mapping(uint256 => S) map;
		}
		mapping(uint256=>S) slot5;
		constructor() {
			slot5[1].str = '${STR_SHORT}';
			slot5[1].map[2].str = '${STR_LONG}';
		}
	}
`})

let resolver = await foundry.deploy({sol: `
	contract Resolver {
		string name = 'raffy';
	}
`});

let registry = await foundry.deploy({sol: `
	contract Registry {

		struct Node { uint256 id; address resolver; }
		mapping (bytes32 => Node) _nodes;
		uint256 _id; // use node 0 = null
	
		function createNode() internal returns (uint256) {
			return ++_id;
		}
		function makeKey(uint256 parent, string memory label) internal pure returns (bytes32) {
			return keccak256(abi.encodePacked(parent, label));
		}
		constructor() {
			uint256 root = createNode();
			uint256 eth = createNode();
			uint256 nick = createNode();
			_nodes[makeKey(root, "eth")].id = eth;
			_nodes[makeKey(eth, "nick")] = Node(nick, ${resolver.target});
		}
	}
`});

let prover = await EVMProver.latest(foundry.provider);

async function dump(req) {
	console.log();
	console.log(req);
	let ctx = await prover.eval(req);
	console.log(ctx);
	let outputs = await prover.getOutputs();
	console.log({
		outputs,
		needs: prover.needs
	});
	return outputs;
}

let req1 = new EVMRequest(5);
req1.push(test.target).setTarget();
req1.push(2).setSlot().readBytes().setOutput(1);
req1.push(3).setSlot().readBytes().setOutput(0);
req1.push(0).setSlot().read(2).setOutput(2);
req1.push(4).setSlot().readArray(6).setOutput(3);
req1.push(5).setSlot().push(1).follow().push(1).addSlot().readBytes().setOutput(4);
let outs1 = await dump(req1);
assert.equal(ethers.toUtf8String(outs1[0]), STR_LONG);
assert.equal(ethers.toUtf8String(outs1[1]), STR_SHORT);


// let req2 = new EVMRequest(1);
// req2.push(new EVMCommand().push(registry.target).pushStack().requireContract());
// req2.push(new EVMCommand().push('0x51050ec063d393217B436747617aD1C2285Aeeee').setTarget().requireContract());
// req2.push(new EVMCommand().push('0x0000000000000000000000000000000000000001').setTarget().requireContract());
// req2.while();
// req2.push(1).setSlot().read().setOutput(0); // node
// await dump(req2);


let req3 = new EVMRequest(3);
req3.push(registry.target).setTarget();
req3.push(1).setOutput(0);
for (let label of ['bar', 'foo', 'nick', 'eth']) {
	req3.push(new EVMCommand()
			.push(0).setSlot() // _nodes mapping
			.pushOutput(0).pushStr(label).concat(2).keccak() // makeKey()
			.follow().read() // id
			.dup().requireNonzero().setOutput(0)
			.debug() // debug print
			// we found a valid subreg, so try to read the resolver
			.push(new EVMCommand().push(1).addSlot().read().dup().requireNonzero().setOutput(1)).eval());
}
req3.eval(false, true); // loop until we get a failure
// outputs = [subreg, resolver]
req3.pushOutput(1).setTarget(); // set target to resolver
req3.push(0).setSlot().readBytes().setOutput(2); // read "name" store into output
await dump(req3);

foundry.shutdown();
