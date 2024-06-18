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
//const OP_READ_ARRAY = 11;
const OP_SLOT_ADD = 12;
const OP_FOLLOW = 13;
const OP_SET_OUTPUT = 14;
const OP_CONCAT = 15;
const OP_KECCAK = 16;
const OP_SLOT_SET = 17;
const OP_PUSH_STACK = 18;
//const OP_EVAL_ALL = 19;
const OP_DEBUG = 20;
const OP_POP_STACK = 21;
const OP_EVAL_PROGRAM = 22;

function namesplit(s) {
	return s ? s.split('.') : [];
}

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
	// clone() {
	// 	return new EVMCommandReader(this.ops, this.inputs, this.pos);
	// }
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

function evalFlags() {

}

class EVMCommand {
	// static decode(v) {
	// 	let cmd = new this();
	// 	let [ops, inputs] = ABI_CODER.decode(['bytes', 'bytes[]'], v);
	// 	cmd.ops.push(...ops);
	// 	cmd.inputs.push(...inputs);
	// 	return cmd;
	// }
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
	//readArray(step) { return this.addByte(OP_READ_ARRAY).addByte(step); }

	pop() { return this.addByte(OP_POP_STACK); }
	setOutput(i) { return this.addByte(OP_SET_OUTPUT).addByte(i); }

	setSlot() { return this.addByte(OP_SLOT_SET); }
	addSlot() { return this.addByte(OP_SLOT_ADD); }
	offset(x) { return this.push(x).addSlot(); }

	setTarget() { return this.addByte(OP_TARGET_SET); }
	requireContract() { return this.addByte(OP_REQ_TARGET_IS_CODE); }
	requireNonzero() { return this.addByte(OP_REQ_NONZERO); }
	dup(back = 0) { return this.addByte(OP_PUSH_STACK).addByte(back); }
	pushOutput(i) { return this.addByte(OP_PUSH_OUTPUT).addByte(i); }
	pushInput(i) { return this.addByte(OP_PUSH).addByte(i); }
	push(x) { return this.pushBytes(ethers.toBeHex(x, 32)); }
	pushStr(s) { return this.addByte(OP_PUSH).addByte(this.addInputStr(s)); }
	pushBytes(v) { return this.addByte(OP_PUSH).addByte(this.addInputBytes(v)); }
	evalProgram({success, failure, acquire, back = 255} = {}) {
		let flags = 0;
		if (success) flags |= 1; // stop on success
		if (failure) flags |= 2; // stop on failure
		if (acquire) flags |= 4; // acquire state
		return this.addByte(OP_EVAL_PROGRAM).addByte(back).addByte((success ? 1 : 0) | (failure ? 2 : 0));
	}
	eval({success, failure, acquire, back = 255} = {}) {
		let flags = 0;
		if (success) flags |= 1; // stop on success
		if (failure) flags |= 2; // stop on failure
		if (acquire) flags |= 4; // acquire state
		return this.addByte(OP_EVAL).addByte(back).addByte((success ? 1 : 0) | (failure ? 2 : 0));
	}
	//inlineEval(v) { return this.addByte(OP_EVAL_INLINE).pushBytes(ABI_CODER.encode(['bytes'], [v.map(r => r.encode())])); }
	concat(n) { return this.addByte(OP_CONCAT).addByte(n); }
	keccak() { return this.addByte(OP_KECCAK); }
	follow() { return this.addByte(OP_FOLLOW); }

	begin() { return new EVMCommand(this); }
	end() {
		let p = this.parent;
		if (!p) throw new Error('no parent');
		this.parent = undefined;
		p.pushBytes(this.encode());
		return p;
	}
}

class EVMRequest extends EVMCommand {
	constructor(outputs = 0) {
		super(undefined);
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
	popSlice(back) {
		return back > 0 ? this.stack.splice(-back).reverse() : [];
	}
	peek(back) {
		if (back >= this.stack.length) throw new Error('stack: overflow');
		return this.stack[this.stack.length-1-back]; // from end
	}
	// async resolveTarget() {
	// 	return this.target = addressFromHex(await unwrap(this.target));
	// }
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
					console.log('DEBUG', ethers.toUtf8String(reader.readInput()), {
						target: ctx.target,
						slot: ctx.slot,
						return: ctx.returnValue,
						stack: await Promise.all(ctx.stack.map(unwrap)),
						outputs: await Promise.all(this.outputs)
					});
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
				case OP_POP_STACK: {
					ctx.pop(); // does this need to be fatal?
					continue;
				}
				case OP_SET_OUTPUT: {
					// let i = reader.readByte();
					// let value = await unwrap(ctx.pop());
					// this.outputs[this.checkOutputIndex(i)] = value;
					// console.log(`output[${i}] = ${value}`);
					this.outputs[this.checkOutputIndex(reader.readByte())] = ctx.pop();
					continue;
				}
				case OP_PUSH: {
					ctx.stack.push(reader.readInput());
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
				// case OP_READ_ARRAY: {
				// 	let step = reader.readByte();
				// 	if (!step) throw new Error('invalid element size'); // ?
				// 	let {target, slot} = ctx;
				// 	let length = this.checkSize(uint256FromHex(await this.proveStorage(target, slot)));
				// 	if (step < 32) {
				// 		let per = 32 / step|0;
				// 		length = (length + per - 1) / per|0;
				// 	} else {
				// 		length = length * ((step + 31) >> 5);
				// 	}
				// 	let slots = [slot, ...solidityArraySlots(slot, length)];
				// 	this.needs.push(...slots.map(x => [target, x]));
				// 	ctx.stack.push(wrap(async () => ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x))))));
				// 	continue;
				// }
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
					let back = reader.readByte();
					let flags = reader.readByte();
					let sub = new Context();
					for (; ctx.stack.length && back; back--) {
						sub.target = ctx.target;
						sub.slot = ctx.slot;
						sub.stack.length = 0;
						await this.evalCommand(EVMCommandReader.fromEncoded(await unwrap(ctx.pop())), sub);
						if (flags & (sub.returnValue ? 2 : 1)) break;
					}
					for (; ctx.stack.length && back; back--) {
						ctx.stack.pop();
					}
					if (flags & 4) { // acquire the state
						ctx.target = sub.target;
						ctx.slot   = sub.slot;
						ctx.stack  = sub.stack;
					}
					continue;
				}
				case OP_EVAL_PROGRAM: {
					let back = reader.readByte();
					let flags = reader.readByte();
					let program = EVMCommandReader.fromEncoded(await unwrap(ctx.pop()));
					let args = ctx.popSlice(back);
					let sub = new Context();
					for (let arg of args) {
						sub.target = ctx.target;
						sub.slot = ctx.slot;
						sub.stack = [arg];
						program.pos = 0;
						await this.evalCommand(program, sub);
						if (flags & (sub.returnValue ? 2 : 1)) break;
					}
					if (flags & 4) { // acquire the state
						ctx.target = sub.target;
						ctx.slot   = sub.slot;
						ctx.stack  = sub.stack;
					}
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

let storage = await foundry.deploy({sol: `
	contract RegistryStorage {
		struct Node { 
			address registry; 
			address resolver; 
		}
		mapping (address => mapping(string => Node)) _nodes;
	
		function setNode(address parent, string memory label, address registry, address resolver) external {
			_nodes[parent][label] = Node(registry, resolver);
		}
	}
`});

async function deploy_registry() {
	return foundry.deploy({sol: `
		contract Registry {	
		}
	`});
}

async function deploy_resolver() {
	return foundry.deploy({sol: `
		contract Resolver {		
			mapping (bytes32 => mapping(string => string)) _texts;
			function setText(bytes32 node, string memory key, string memory value) external {
				_texts[node][key] = value;
			}
		}
	`});
}

let root = await deploy_registry();
let root_eth = await deploy_registry();
let root_eth_nick = await deploy_registry();

let leaf_resolver = await deploy_resolver(); 
let nick_resolver = await deploy_resolver(); 

await foundry.confirm(storage.setNode(root, 'eth', root_eth.target, ethers.ZeroAddress));
await foundry.confirm(storage.setNode(root_eth, 'nick', root_eth_nick.target, nick_resolver.target));
await foundry.confirm(storage.setNode(root_eth, 'leaf', ethers.ZeroAddress, leaf_resolver.target));

await foundry.confirm(nick_resolver.setText(ethers.namehash('foo.bar.nick.eth'), 'name', 'Foo'));
await foundry.confirm(nick_resolver.setText(ethers.namehash('nick.eth'), 'name', 'Nick'));
await foundry.confirm(leaf_resolver.setText(ethers.namehash('leaf.eth'), 'name', 'Leaf'));

let prover = await EVMProver.latest(foundry.provider);

async function resolve(name) {
	let req = new EVMRequest(3);
	req.push(storage.target).setTarget(); // use storage contract
	req.push(root.target).setOutput(0); // start at root
	for (let label of namesplit(name)) {
		req.pushStr(label);
	}
	req.push(0).setSlot() // _nodes mapping
	req.begin()
		.pushOutput(0) // registry (as uint256)
		.follow().follow() // map[subreg][label]
		.read() // registry
		//.debug(label)
		.begin()
			.push(1).addSlot().read() // resolver
			.dup().requireNonzero() // read and require resolver
			.setOutput(1) // save it
		.end().eval({back: 1})
		.dup().requireNonzero() // require registry
		//.debug()
		.setOutput(0) // save it
	.end()
	.evalProgram({failure: true}) // loop until we get a failure
	req.pushOutput(1).setTarget() // set target to resolver
		.push(0).setSlot() // _texts mapping
		.push(ethers.namehash(name)).follow().pushStr('name').follow() // _texts[node][key]
		.readBytes().setOutput(2); // read text(name) store into output
		
	
	let ctx = await prover.eval(req);
	//console.log(req.encode());
	let outputs = await prover.getOutputs();
	if (0) {
		console.log();
		console.log(name);
		console.log(req);
		console.log(ctx);
		console.log({
			outputs,
			needs: prover.needs
		});
	}

	console.log(`name(${name}) = "${ethers.toUtf8String(outputs[2])}"`);
}

await resolve('foo.bar.nick.eth');
await resolve('nick.eth');
await resolve('leaf.eth');
await resolve('doesnotexist.eth');

foundry.shutdown();
