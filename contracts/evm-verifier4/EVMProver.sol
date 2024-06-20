// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./EVMProtocol.sol";

import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {Bytes} from "@eth-optimism/contracts-bedrock/src/libraries/Bytes.sol";
import {SecureMerkleTrie} from "../trie-with-nonexistance/SecureMerkleTrie.sol";

import "forge-std/console2.sol"; // DEBUG

library EVMProver {

	// https://adraffy.github.io/keccak.js/test/demo.html#algo=keccak-256&s=80&escape=1&encoding=hex
	bytes32 constant NULL_TRIE_ROOT = keccak256(hex"80");

	// utils
	function uint256FromBytes(bytes memory v) internal pure returns (uint256) {
		return uint256(v.length < 32 ? bytes32(v) >> ((32 - v.length) << 3) : bytes32(v));
	}
	function isZeros(bytes memory v) internal pure returns (bool ret) {
		assembly {
			let p := add(v, 32)
			let e := add(p, mload(v))
			for { ret := 1 } lt(p, e) { p := add(p, 32) } {
				if iszero(iszero(mload(p))) { // != 0
					ret := 0
					break
				}
			}
		}
	}

	// proof verification
	function getStorageRoot(bytes32 stateRoot, address target, bytes[] memory witness) private pure returns (bytes32) {
		(bool exists, bytes memory v) = SecureMerkleTrie.get(abi.encodePacked(target), witness, stateRoot);
		if (!exists) return NULL_TRIE_ROOT; // TODO: is this ever false? is this safe?
		RLPReader.RLPItem[] memory accountState = RLPReader.readList(v);
		return bytes32(RLPReader.readBytes(accountState[2]));
	}
	function getStorageValue(bytes32 storageRoot, uint256 slot, bytes[] memory witness) private pure returns (bytes memory) {
		(bool exists, bytes memory v) = SecureMerkleTrie.get(abi.encodePacked(slot), witness, storageRoot);
		return exists ? RLPReader.readBytes(v) : bytes('');
	}
	

	struct Machine {
		bytes buf;
		uint256 pos;
		bytes[] inputs;
		uint256 slot;
		bytes[] stack;
		uint256 stackSize;
		address target;
		bytes32 storageRoot;
		ProofSequence proofs;
	}

	using EVMProver for Machine;

	function push(Machine memory vm, bytes memory v) internal pure {
		vm.stack[vm.stackSize++] = v;
	}
	function pop(Machine memory vm) internal pure returns (bytes memory) {
		return vm.stack[--vm.stackSize];
	}
	function peek(Machine memory vm, uint8 back) internal pure returns (bytes memory v) {
		if (back < vm.stackSize) {
			v = vm.stack[vm.stackSize - 1 - back];
		}
	}
	function checkRead(Machine memory vm, uint256 n) internal pure returns (uint256 ptr) {
		uint256 pos = vm.pos;
		bytes memory buf = vm.buf;
		if (pos + n > buf.length) revert RequestInvalid();
		assembly { ptr := add(add(buf, 32), pos) }
		vm.pos = pos + n;
	}
	function readByte(Machine memory vm) internal pure returns (uint8 i) {
		uint256 src = vm.checkRead(1);
		assembly { i := shr(248, mload(src)) }
	}
	function readShort(Machine memory vm) internal pure returns (uint16 i) {
		uint256 src = vm.checkRead(2);
		assembly { i := shr(240, mload(src)) }
	}
	/*
	function readBytes(Machine memory vm) internal pure returns (bytes memory v) {
		uint256 n = vm.readShort();
		uint256 src = vm.checkRead(n);
		v = new bytes(n);
		uint256 dst;
		assembly { dst := v }
		for (uint256 i; i < n; i += 32) {
			assembly {
				dst := add(dst, 32)
				mstore(dst, mload(add(src, i)))
			}
		}
	}
	*/

	function readProof(Machine memory vm) internal pure returns (bytes[] memory) {
		ProofSequence memory p = vm.proofs;
		return p.data[uint8(p.map[p.index++])];
	}
	function dump(Machine memory vm) internal pure {
		console2.log("[pos=%s/%s]", vm.pos, vm.buf.length);
		console2.log("[target=%s slot=%s]", vm.target, vm.slot);
		console2.log("[proof=%s/%s]", vm.proofs.index, vm.proofs.map.length);
		console2.logBytes(vm.buf);
		for (uint256 i; i < vm.stackSize; i++) {
			console2.log("[stack=%s size=%s]", i, vm.stack[i].length);
			console2.logBytes(vm.stack[i]);
		}
	}
	function getStorage(Machine memory vm, uint256 slot) internal pure returns (uint256) {
		return uint256FromBytes(getStorageValue(vm.storageRoot, slot, vm.readProof()));
	}
	function proveSlots(Machine memory vm, uint256 count) internal pure returns (bytes memory v) {
		v = new bytes(count << 5);
		for (uint256 i; i < count; ) {
			uint256 value = vm.getStorage(vm.slot + i);
			i += 1;
			assembly { mstore(add(v, shl(5, i)), value) }
		}
	}
	function proveBytes(Machine memory vm) internal pure returns (bytes memory v) {
		uint256 first = vm.getStorage(vm.slot);
		if ((first & 1) == 0) { // small
			v = new bytes((first & 0xFF) >> 1);
			assembly { mstore(add(v, 32), first) }
		} else { // large
			uint256 size = first >> 1; // number of bytes
			first = (size + 31) >> 5; // number of slots
			v = new bytes(size);
			uint256 slot = uint256(keccak256(abi.encode(vm.slot))); // array start
			for (uint256 i; i < first; ) {
				uint256 value = vm.getStorage(slot + i);
				i += 1;
				assembly { mstore(add(v, shl(5, i)), value) }
			}
		}
	}
	function proveArray(Machine memory vm, uint256 step) internal pure returns (bytes memory v) {
		uint256 first = vm.getStorage(vm.slot);
		uint256 count;
		if (step < 32) {
			uint256 per = 32 / step;
			count = (first + per - 1) / per;
		} else {
			count = first * ((step + 31) >> 5);
		}
		v = new bytes((1 + count) << 5); // +1 for length
		assembly { mstore(add(v, 32), first) } // store length
		uint256 slot = uint256(keccak256(abi.encode(vm.slot))); // array start
		for (uint256 i; i < count; ) {
			uint256 value = vm.getStorage(slot + i);
			i += 1;
			assembly { mstore(add(v, shl(5, add(i, 1))), value) }
		}
	}

	function evalRequest(EVMRequest memory req, ProofSequence memory proofs) internal pure returns (bytes[] memory outputs, uint8 exitCode) {
		Machine memory vm;
		vm.buf = req.ops;
		vm.inputs = req.inputs;
		vm.stack = new bytes[](MAX_STACK);
		vm.storageRoot = NULL_TRIE_ROOT;
		vm.proofs = proofs;
		outputs = new bytes[](vm.readByte());
		exitCode = evalCommand(vm, outputs);
	}

	function evalCommand(Machine memory vm, bytes[] memory outputs) internal pure returns (uint8 exitCode) {
		while (vm.pos < vm.buf.length) {
			uint256 op = vm.readByte();
			if (op == OP_TARGET) {
				vm.target = address(uint160(uint256FromBytes(vm.pop())));
				vm.storageRoot = getStorageRoot(vm.proofs.stateRoot, vm.target, vm.readProof());
				vm.slot = 0;
			} else if (op == OP_SET_OUTPUT) {
				outputs[vm.readByte()] = vm.pop();
			} else if (op == OP_REQ_TARGET) {
				if (vm.storageRoot == NULL_TRIE_ROOT) return 1;
			} else if (op == OP_REQ_NONZERO) {
				if (isZeros(vm.peek(vm.readByte()))) return 1;
			} else if (op == OP_READ_SLOTS) {
				vm.push(vm.proveSlots(vm.readByte()));
				vm.dump();
			} else if (op == OP_READ_BYTES) {
				vm.push(vm.proveBytes());
			} else if (op == OP_READ_ARRAY) {
				vm.push(vm.proveArray(vm.readByte()));
			} else if (op == OP_PUSH_INPUT) {
				vm.push(abi.encodePacked(vm.inputs[vm.readByte()]));
			} else if (op == OP_PUSH_OUTPUT) {
				vm.push(abi.encodePacked(outputs[vm.readByte()]));
			} else if (op == OP_PUSH_SLOT) {
				vm.push(abi.encode(vm.slot));
			} else if (op == OP_PUSH_TARGET) {
				vm.push(abi.encode(vm.target));
			} else if (op == OP_DUP) {
				vm.push(abi.encodePacked(vm.peek(vm.readByte())));
			} else if (op == OP_POP) {
				if (vm.stackSize != 0) --vm.stackSize;
			} else if (op == OP_SLOT_ZERO) {
				vm.slot = 0;
			} else if (op == OP_SLOT_ADD) {
				vm.slot += uint256FromBytes(vm.pop());
			} else if (op == OP_SLOT_FOLLOW) {
				vm.slot = uint256(keccak256(abi.encodePacked(vm.pop(), vm.slot)));
			} else if (op == OP_STACK_SLICE) {
				vm.push(Bytes.slice(vm.pop(), vm.readByte(), vm.readByte()));
			} else if (op == OP_STACK_KECCAK) {
				vm.push(abi.encodePacked(keccak256(vm.pop())));
			} else if (op == OP_STACK_CONCAT) {
				uint8 back = vm.readByte();
				bytes memory v;
				for (; back > 0 && vm.stackSize > 0; --back) {
					v = bytes.concat(vm.pop(), v);
				}
				vm.push(v);
			} else if (op == OP_EVAL) {
				uint8 back = vm.readByte();
				uint8 flags = vm.readByte();
				Machine memory sub;
				(sub.buf, sub.inputs) = abi.decode(vm.pop(), (bytes, bytes[]));
				sub.proofs = vm.proofs;
				sub.stack = new bytes[](MAX_STACK);
				for (; back > 0 && vm.stackSize > 0; --back) {
					sub.target = vm.target;
					sub.storageRoot = vm.storageRoot;
					sub.slot = vm.slot;
					sub.stackSize = 0;
					sub.push(vm.pop());
					exitCode = evalCommand(sub, outputs);
					if ((flags & (exitCode != 0 ? 2 : 1)) != 0) {
						break;
					}
				}
				if ((flags & 4) != 0) {
					vm.target      = sub.target;
					vm.storageRoot = sub.storageRoot;
					vm.slot        = sub.slot;
					vm.stack       = sub.stack;
					vm.stackSize   = sub.stackSize;
				} else {
					vm.stackSize = vm.stackSize > back ? vm.stackSize - back : 0;
				}
			} else {
				revert RequestInvalid();
			}
		}
		return 0;
	}


}