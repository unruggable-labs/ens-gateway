// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {GatewayRequest} from "./GatewayRequest.sol";

uint256 constant MAX_OPS = 256;
uint16 constant MAX_INPUTS = 32;
uint16 constant MAX_OUTPUTS = 256;

uint8 constant OP_PATH_START  = 1;
uint8 constant OP_PATH_END    = 9;
uint8 constant OP_PUSH    = 3;
uint8 constant OP_SLOT_ADD     = 4;
uint8 constant OP_SLOT_FOLLOW  = 5;
uint8 constant OP_STACK_KECCAK  = 6;
uint8 constant OP_PUSH_BYTE = 7;
uint8 constant OP_PUSH_OUTPUT     = 8;
uint8 constant OP_STACK_SLICE = 10;

interface GatewayAPI {
	function fetch(
		bytes memory context, 
		uint256 outputs, 
		bytes memory ops, 
		bytes[] memory inputs
	) external pure returns (bytes memory witness);
}

library EVMFetcher {

	error Overflow();

	function create() internal pure returns (GatewayRequest memory) {
		bytes memory ops = new bytes(MAX_OPS);
		bytes[] memory inputs =  new bytes[](MAX_INPUTS);
		assembly {
			mstore(ops, 0)
			mstore(inputs, 0)
		}
		return GatewayRequest(0, ops, inputs);
	}
	function addOp(GatewayRequest memory req, uint8 op) internal pure {
		unchecked {
			bytes memory v = req.ops;
			uint256 n = v.length + 1;
			if (n > MAX_OPS) revert Overflow();
			assembly {
				mstore(v, n)
				mstore8(add(add(v, 31), n), op)
			}
		}
	}
	function addConst(GatewayRequest memory req, bytes memory v) internal pure returns (uint8 ci) {
		unchecked {
			bytes[] memory m = req.inputs;
			uint256 n = m.length + 1;
			if (n > MAX_INPUTS) revert Overflow();
			assembly { 
				mstore(m, n) 
				mstore(add(m, shl(5, n)), v)
				ci := sub(n, 1)
			}
		}
	}
	function start(GatewayRequest memory req) internal pure {
		unchecked { 
			req.outputs += 1;
			if (req.outputs > MAX_OUTPUTS) revert Overflow();
			addOp(req, OP_PATH_START);
		}
	}
	function end(GatewayRequest memory req, uint8 size) internal pure {
		addOp(req, OP_PATH_END);
		addOp(req, size);
	}
	function output(GatewayRequest memory req, uint8 oi) internal pure {
		addOp(req, OP_PUSH_OUTPUT);
		addOp(req, oi);
	}
	function slice(GatewayRequest memory req, uint8 a, uint8 n) internal pure {
		addOp(req, OP_STACK_SLICE);
		addOp(req, a);
		addOp(req, n);
	}
	function push(GatewayRequest memory req, uint256 x) internal pure { 
		if (x < 256) {
			addOp(req, OP_PUSH_BYTE);
			addOp(req, uint8(x));
		} else {
			push(req, abi.encode(x)); 
		}
	}
	function push(GatewayRequest memory req, address x) internal pure { push(req, abi.encode(x)); }
	function push(GatewayRequest memory req, bytes32 x) internal pure { push(req, abi.encode(x)); }
	function push(GatewayRequest memory req, bytes memory v) internal pure {
		addOp(req, OP_PUSH);
		addOp(req, addConst(req, v));
	}
	function input(GatewayRequest memory req, uint8 ci) internal pure {
		addOp(req, OP_PUSH);
		addOp(req, ci);
	}
	function follow(GatewayRequest memory req) internal pure {
		addOp(req, OP_SLOT_FOLLOW);
	}
	function add(GatewayRequest memory req) internal pure {
		addOp(req, OP_SLOT_ADD);
	}
	// function concat(GatewayRequest memory req) internal pure {
	// 	addOp(req, OP_CONCAT);
	// }
 	function keccak(GatewayRequest memory req, uint8 n) internal pure {
		addOp(req, OP_STACK_KECCAK);
		addOp(req, n);
	}

	function encode(GatewayRequest memory req, bytes memory context) internal pure returns (bytes memory) {
		return abi.encodeCall(GatewayAPI.fetch, (context, req.outputs, req.ops, req.inputs));
	}

}
