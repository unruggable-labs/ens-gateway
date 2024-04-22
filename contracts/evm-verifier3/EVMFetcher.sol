// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IEVMVerifier} from "./IEVMVerifier.sol";
import {EVMFetchTarget} from "./EVMFetchTarget.sol";
import {IEVMGateway} from "./IEVMGateway.sol";

uint256 constant MAX_OPS = 256;
uint16 constant MAX_INPUTS = 32;
uint16 constant MAX_OUTPUTS = 256;

uint8 constant OP_PATH_START  = 1;
uint8 constant OP_PUSH    = 3;
uint8 constant OP_ADD     = 4;
uint8 constant OP_FOLLOW  = 5;
uint8 constant OP_KECCAK  = 6;
uint8 constant OP_COPY    = 7;
uint8 constant OP_REF     = 8;
uint8 constant OP_PATH_END    = 9;

library EVMFetcher {

	error Overflow();
	error OffchainLookup(address sender, string[] urls, bytes request, bytes4 callback, bytes carry);

	struct Req {
		uint256 outputs;
		bytes ops;
		bytes[] inputs;
	}

	function create() internal pure returns (Req memory) {
		bytes memory ops = new bytes(MAX_OPS);
		bytes[] memory inputs =  new bytes[](MAX_INPUTS);
		assembly {
			mstore(ops, 0)
			mstore(inputs, 0)
		}
		return Req(0, ops, inputs);
	}
	function addOp(Req memory req, uint8 op) internal pure {
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
	function addConst(Req memory req, bytes memory v) internal pure returns (uint8 ci) {
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
	function start(Req memory req) internal pure {
		unchecked { 
			req.outputs += 1;
			if (req.outputs > MAX_OUTPUTS) revert Overflow();
			addOp(req, OP_PATH_START);
		}
	}
	function end(Req memory req, uint8 size) internal pure {
		addOp(req, OP_PATH_END);
		addOp(req, size);
	}
	function copy(Req memory req, uint8 ci) internal pure {
		addOp(req, OP_COPY);
		addOp(req, ci);
	}
	function ref(Req memory req, uint8 oi) internal pure {
		addOp(req, OP_REF);
		addOp(req, oi);
	}
	function push(Req memory req, address x) internal pure { push(req, abi.encode(x)); }
	function push(Req memory req, uint256 x) internal pure { push(req, abi.encode(x)); }
	function push(Req memory req, bytes32 x) internal pure { push(req, abi.encode(x)); }
	function push(Req memory req, bytes memory v) internal pure {
		addOp(req, OP_PUSH);
		addOp(req, addConst(req, v));
	}
	function follow(Req memory req) internal pure {
		addOp(req, OP_FOLLOW);
	}
	function add(Req memory req) internal pure {
		addOp(req, OP_ADD);
	}
	function keccak(Req memory req) internal pure {
		addOp(req, OP_KECCAK);
	}

	function fetch(Req memory req, IEVMVerifier verifier, bytes4 callback, bytes memory carry) internal view {
		(string[] memory urls, bytes memory context) = verifier.getStorageContext();
		revert OffchainLookup(
			address(this),
			urls,
			abi.encodeCall(IEVMGateway.fetch, (context, uint16(req.outputs), req.ops, req.inputs)),
			EVMFetchTarget.getStorageSlotsCallback.selector,
			abi.encode(verifier, context, req.outputs, req.ops, req.inputs, callback, carry)
		);
	}

	function debug(Req memory req) internal pure returns (bytes memory) {
		return abi.encodeCall(IEVMGateway.fetch, ('', uint16(req.outputs), req.ops, req.inputs));
	}

}
