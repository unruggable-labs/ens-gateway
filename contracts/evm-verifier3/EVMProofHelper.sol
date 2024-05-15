// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./GatewayRequest.sol";
import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {SecureMerkleTrie} from "../trie-with-nonexistance/SecureMerkleTrie.sol";

import "forge-std/console2.sol";

struct StateProof {
	uint256 accountIndex;
	//uint8 accountIndex;
	//address account;
	bytes[][] storageProofs;
}


struct VMState {
	uint256 slot;
	uint256 stackIndex;
	uint256 proofIndex;
	uint256 outputIndex;
	bytes32 storageRoot;
	bytes[] stack;
	bytes[] outputs;
}

library EVMProofHelper {

	// utils
	function _toUint256(bytes memory v) internal pure returns (uint256) {
		return uint256(v.length < 32 ? bytes32(v) >> ((32 - v.length) << 3) : bytes32(v));
	}

	// proof verification
	function getStorageRoot(bytes32 stateRoot, address target, bytes[] memory witness) private pure returns (bool exists, bytes32 storageRoot) {
		bytes memory v;
		console2.log("target=%s", target);
		console2.logBytes32(stateRoot);
		for (uint256 i; i < witness.length; i++) {
			console2.logBytes(witness[i]);
		}
		(exists, v) = SecureMerkleTrie.get(abi.encodePacked(target), witness, stateRoot);
		console2.log("exists=%s", exists);
		if (exists) {
			RLPReader.RLPItem[] memory accountState = RLPReader.readList(v);
			storageRoot = bytes32(RLPReader.readBytes(accountState[2]));
		}
	}
	function getSingleStorageProof(bytes32 storageRoot, uint256 slot, bytes[] memory witness) private pure returns (bytes memory) {
		(bool exists, bytes memory retrievedValue) = SecureMerkleTrie.get(
			abi.encodePacked(slot),
			witness,
			storageRoot
		);
		if(!exists) {
			// Nonexistent values are treated as zero.
			return "";
		}
		return RLPReader.readBytes(retrievedValue);
	}
	function getStorage(bytes32 storageRoot, uint256 slot, bytes[] memory witness) private pure returns (uint256) {
		return _toUint256(getSingleStorageProof(storageRoot, slot, witness));
	}
	function proveOutput(bytes32 storageRoot, bytes[][] memory storageProofs, uint256 slot, uint256 step) internal pure returns (bytes memory v) {
		uint256 first = getStorage(storageRoot, slot, storageProofs[0]);
		if (step == 0) return abi.encode(first);
		uint256 size;
		if (step == 1 && (first & 1) == 0) {
			size = (first & 0xFF) >> 1;
			v = new bytes(size);
			assembly { mstore(add(v, 32), first) }
		} else {
			size = (first >> 1) * step; // number of bytes
			first = (size + 31) >> 5; // rename: number of slots
			slot = uint256(keccak256(abi.encode(slot))); // array start
			v = new bytes(size);
			uint256 i;
			while (i < first) {
				i += 1;
				uint256 value = getStorage(storageRoot, slot, storageProofs[i]);
				assembly { mstore(add(v, shl(5, i)), value) }
				slot += 1;
			}
		}
	}

	using EVMProofHelper for VMState;

	// VMState
	function push(VMState memory state, bytes memory v) internal pure {
		state.stack[state.stackIndex++] = v;
	}
	function pop(VMState memory state) internal pure returns (bytes memory) {
		return state.stack[--state.stackIndex];
	}
	function pop_uint256(VMState memory state) internal pure returns (uint256) {
		return _toUint256(pop(state));
	}
	function pop_address(VMState memory state) internal pure returns (address) {
		return address(uint160(pop_uint256(state)));
	}	
	function add_output(VMState memory state, bytes memory v) internal pure {
		state.outputs[state.outputIndex++] = v;
	}
	function dump(VMState memory state) internal pure {
		for (uint256 i; i < state.stackIndex; i++) {
			console2.log("[stack=%s size=%s]", i, state.stack[i].length);
			console2.logBytes(state.stack[i]);
		}
	}

	function getStorageValues(GatewayRequest memory req, bytes32 stateRoot, bytes[][] memory accountProofs, StateProof[] memory stateProofs) internal pure returns(bytes[] memory) {
		
		console2.log("[accounts=%s states=%s]", accountProofs.length, stateProofs.length);

		VMState memory state;
		state.stack = new bytes[](16);
		state.outputs = new bytes[](uint8(req.ops[0]));
		for (uint256 i = 1; i < req.ops.length; ) {
			uint256 op = uint8(req.ops[i++]);
			if (op == OP_TARGET) {
				bool exists;
				address target = state.pop_address();
				(exists, state.storageRoot) = getStorageRoot(
					stateRoot,
					target,
					accountProofs[stateProofs[state.proofIndex].accountIndex]
				);
				if (!exists) revert AccountNotFound(target);
				state.slot = 0;
			} else if (op == OP_TARGET_FIRST) {
				// interpret stack as addresses
				// pop until we find an account that exists
				// throw if none exist
				// set target to found account
				bool exists;
				state.dump();
				while (state.stackIndex != 0 && !exists) {
					console2.log("try %s at index %s for %s", state.stackIndex, stateProofs[state.proofIndex].accountIndex);
					(exists, state.storageRoot) = getStorageRoot(
						stateRoot,
						state.pop_address(),
						accountProofs[stateProofs[state.proofIndex++].accountIndex]
					);
				}
				if (!exists) revert AccountNotFound(address(0));
				state.stackIndex = 0;
				state.slot = 0;
			} else if (op == OP_COLLECT_FIRST) {
				// interpret stack as slots
				// pop until we find a slot that exists
				// if not found, use empty bytes
				// add result as output
				// TODO: should this throw?
				uint8 step = uint8(req.ops[i++]);
				bytes memory v;
				while (state.stackIndex != 0 && v.length == 0) {
					v = proveOutput(
						state.storageRoot,
						stateProofs[state.proofIndex++].storageProofs,
						state.pop_uint256(),
						step
					);
					if (step == 0 && _toUint256(v) == 0) v = '';
					//if ((step == 0 ? _toUint256(v) : v.length) != 0) break;
				}
				state.add_output(v);
				state.stackIndex = 0;
				state.slot = 0;
			} else if (op == OP_COLLECT) {
				state.add_output(proveOutput(
					state.storageRoot,
					stateProofs[state.proofIndex++].storageProofs,
					state.slot,
					uint8(req.ops[i++])
				));
				state.slot = 0;
			} else if (op == OP_PUSH) {
				state.push(abi.encodePacked(req.inputs[uint8(req.ops[i++])]));
			} else if (op == OP_PUSH_OUTPUT) {
				state.push(abi.encodePacked(state.outputs[uint8(req.ops[i++])]));
			} else if (op == OP_PUSH_SLOT) {
				state.push(abi.encode(state.slot));
			} else if (op == OP_SLOT_ADD) {
				state.slot += state.pop_uint256();
			} else if (op == OP_SLOT_SET) {
				state.slot = state.pop_uint256();
			} else if (op == OP_SLOT_FOLLOW) {
				state.slot = uint256(keccak256(abi.encodePacked(state.pop(), state.slot)));
			} else if (op == OP_STACK_SLICE) {
				bytes memory v = state.pop();
				uint256 x = uint8(req.ops[i++]);
				uint256 n = uint8(req.ops[i++]);
				if (v.length < x + n) revert InvalidGatewayRequest();
				assembly {
					v := add(v, x)
					mstore(v, n)
				}
				state.push(v);
			} else if (op == OP_STACK_KECCAK) {
				state.push(abi.encodePacked(keccak256(state.pop())));
			} else if (op == OP_STACK_CONCAT) {
				bytes memory v = state.pop();
				state.push(abi.encodePacked(state.pop(), v));
			} else if (op == OP_STACK_FIRST) {
				// interpret stack as bytes[]
				// pop until non-empty
				// TODO: wat do about uint256 format
				bytes memory v;
				while (state.stackIndex != 0 && v.length == 0) v = state.pop();
				state.stackIndex = 0;
				state.push(v);
			} else {
				revert InvalidGatewayRequest();
			}
		}
		return state.outputs;
	}

}