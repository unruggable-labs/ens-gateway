// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./EVMProtocol.sol";

uint256 constant MAX_OPS = 2048;
uint256 constant MAX_INPUTS = 64;

library EVMRequestLib {

	using EVMRequestLib for EVMRequest;
	
	function newRequest(uint8 outputs) internal pure returns (EVMRequest memory r) {
		r = newCommand();
		r.addByte(outputs);
	}
	function newCommand() internal pure returns (EVMRequest memory) {
		bytes memory v = new bytes(MAX_OPS);
		bytes[] memory m = new bytes[](MAX_INPUTS);
		assembly {
			mstore(v, 0)
			mstore(m, 0)
		}
		return EVMRequest(v, m);
	}

	function addByte(EVMRequest memory r, uint8 i) internal pure returns (EVMRequest memory) {
		bytes memory v = r.ops;
		uint256 n = v.length + 1;
		if (n > MAX_OPS) revert RequestOverflow();
		assembly {
			mstore(v, n)
			mstore8(add(add(v, 31), n), i)
		}
		return r;
	}

	// function addBigOp(EVMRequest memory r, uint24 i) internal pure {
	// 	r.addByte(uint8(i >> 16));
	// 	r.addByte(uint8(i >> 8));
	// 	r.addByte(uint8(i));
	// }

	function addInput(EVMRequest memory r, bytes memory v) internal pure returns (uint8 ii) {
		unchecked {
			bytes[] memory m = r.inputs;
			uint256 n = m.length + 1;
			if (n > MAX_INPUTS) revert RequestOverflow();
			assembly {
				mstore(m, n) 
				mstore(add(m, shl(5, n)), v)
				ii := sub(n, 1)
			}
		}
	}

	// function outputCount(EVMRequest memory r) internal pure returns (uint8) {
	// 	return uint8(r.ops[0]);
	// }

	function target(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_TARGET); }
	function setOutput(EVMRequest memory r, uint8 i) internal pure returns (EVMRequest memory) { return r.addByte(OP_SET_OUTPUT).addByte(i); }

	function read(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_READ_SLOTS).addByte(1); }
	function read(EVMRequest memory r, uint8 n) internal pure returns (EVMRequest memory) { return r.addByte(OP_READ_SLOTS).addByte(n); }
	function readBytes(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_READ_BYTES); }
	function readArray(EVMRequest memory r, uint8 step) internal pure returns (EVMRequest memory) { return r.addByte(OP_READ_ARRAY).addByte(step); }
	
	function push(EVMRequest memory r, uint256 x) internal pure returns (EVMRequest memory) { return push(r, abi.encode(x)); }
	function push(EVMRequest memory r, address x) internal pure returns (EVMRequest memory) { return push(r, abi.encode(x)); }
	function push(EVMRequest memory r, bytes32 x) internal pure returns (EVMRequest memory) { return push(r, abi.encode(x)); }
	function push(EVMRequest memory r, string memory s) internal pure returns (EVMRequest memory) { return push(r, bytes(s)); }
	function push(EVMRequest memory r, EVMRequest memory x) internal pure returns (EVMRequest memory) { return push(r, abi.encode(x)); }
	function push(EVMRequest memory r, bytes memory v) internal pure returns (EVMRequest memory) { 
		return r.addByte(OP_PUSH_INPUT).addByte(r.addInput(v)); 
	}
	
	function pop(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_POP); }
	function dup(EVMRequest memory r, uint8 back) internal pure returns (EVMRequest memory) { return r.addByte(OP_DUP).addByte(back); }

	function pushInput(EVMRequest memory r, uint8 i) internal pure returns (EVMRequest memory) { return r.addByte(OP_PUSH_INPUT).addByte(i); }
	function pushOutput(EVMRequest memory r, uint8 i) internal pure returns (EVMRequest memory) { return r.addByte(OP_PUSH_OUTPUT).addByte(i); }
	function pushSlotRegister(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_PUSH_SLOT); }
	function pushTargetRegister(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_PUSH_TARGET); }

	function addSlot(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_SLOT_ADD); }
	function zeroSlot(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_SLOT_ZERO); }	
	function follow(EVMRequest memory r) internal pure returns (EVMRequest memory) { return r.addByte(OP_SLOT_FOLLOW); }

	function offset(EVMRequest memory r, uint256 x) internal pure returns (EVMRequest memory) { return r.push(x).addSlot(); }

	// function follow(EVMRequest memory r, uint256 x) internal pure returns (EVMRequest memory) { return r.push(x).follow(); }
	// function follow(EVMRequest memory r, bytes32 x) internal pure returns (EVMRequest memory) { return r.push(x).follow(); }
	// function follow(EVMRequest memory r, address x) internal pure returns (EVMRequest memory) { return r.push(x).follow(); }
	// function follow(EVMRequest memory r, string memory s) internal pure returns (EVMRequest memory) { return r.push(s).follow(); }
	// function follow(EVMRequest memory r, bytes memory v) internal pure returns (EVMRequest memory) { return r.push(v).follow(); }

	function concat(EVMRequest memory r, uint8 n) internal pure returns (EVMRequest memory) {
		return r.addByte(OP_STACK_CONCAT).addByte(n);
	}
 	function keccak(EVMRequest memory r) internal pure returns (EVMRequest memory) {
		return r.addByte(OP_STACK_KECCAK);
	}
	function slice(EVMRequest memory r, uint8 pos, uint8 len) internal pure returns (EVMRequest memory) {
		return r.addByte(OP_STACK_SLICE).addByte(pos).addByte(len);
	}

}
