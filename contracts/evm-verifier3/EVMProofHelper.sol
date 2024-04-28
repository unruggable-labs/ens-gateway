// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./GatewayRequest.sol";
import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {SecureMerkleTrie} from "../trie-with-nonexistance/SecureMerkleTrie.sol";

import "forge-std/console2.sol";

struct StateProof {
	uint256 accountIndex;
	bytes[][] storageProofs;
}

library EVMProofHelper {

	error AccountNotFound(address);
	error Invalid();

	/**
	* @notice Get the storage root for the provided merkle proof
	* @param stateRoot The state root the witness was generated against
	* @param target The address we are fetching a storage root for
	* @param witness A witness proving the value of the storage root for `target`.
	* @return The storage root retrieved from the provided state root
	*/
	function getStorageRoot(bytes32 stateRoot, address target, bytes[] memory witness) private pure returns (bytes32) {
		(bool exists, bytes memory encodedResolverAccount) = SecureMerkleTrie.get(
			abi.encodePacked(target),
			witness,
			stateRoot
		);
		if(!exists) {
			revert AccountNotFound(target);
		}
		RLPReader.RLPItem[] memory accountState = RLPReader.readList(encodedResolverAccount);
		return bytes32(RLPReader.readBytes(accountState[2]));
	}

	/**
	* @notice Prove whether the provided storage slot is part of the storageRoot
	* @param storageRoot the storage root for the account that contains the storage slot
	* @param slot The storage key we are fetching the value of
	* @param witness the StorageProof struct containing the necessary proof data
	* @return The retrieved storage proof value or 0x if the storage slot is empty
	*/
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
			if (size > 0) assembly { mstore(add(v, 32), first) }
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

	function _toUint256(bytes memory v) internal pure returns (uint256) {
		return uint256(v.length < 32 ? bytes32(v) >> ((32 - v.length) << 3) : bytes32(v));
	}

	function getStorageValues(GatewayRequest memory req, bytes32 stateRoot, bytes[][] memory accountProofs, StateProof[] memory stateProofs) internal pure returns(bytes[] memory outputs) {
		//outputs = new bytes[](req.outputs);
		outputs = new bytes[](uint8(req.ops[0]));
		bytes[] memory stack = new bytes[](16);
		uint256 slot;
		uint256 stackIndex;
		uint256 outputIndex;
		bytes32 storageRoot;
		for (uint256 i = 1; i < req.ops.length; ) {
			uint256 op = uint8(req.ops[i++]);
			if (op == OP_PATH_START) {
				storageRoot = getStorageRoot(
					stateRoot,
					address(uint160(_toUint256(stack[--stackIndex]))),
					accountProofs[stateProofs[outputIndex].accountIndex]
				);
			} else if (op == OP_PATH_END) {
				outputs[outputIndex] = proveOutput(
					storageRoot,
					stateProofs[outputIndex].storageProofs,
					slot,
					uint8(req.ops[i++])
				);
				slot = 0;
				outputIndex++;
			} else if (op == OP_PUSH) {
				stack[stackIndex++] = abi.encodePacked(req.inputs[uint8(req.ops[i++])]);
			//} else if (op == OP_PUSH_BYTE) {
			//	stack[stackIndex++] = abi.encode(uint8(req.ops[i++]));
			} else if (op == OP_PUSH_OUTPUT) {
				stack[stackIndex++] = abi.encodePacked(outputs[uint8(req.ops[i++])]);
			} else if (op == OP_SLOT_ADD) {
				slot += _toUint256(stack[--stackIndex]);
			} else if (op == OP_SLOT_FOLLOW) {
				slot = uint256(keccak256(abi.encodePacked(stack[--stackIndex], slot)));
			} else if (op == OP_STACK_SLICE) {
				bytes memory v = stack[stackIndex-1];
				uint256 x = uint8(req.ops[i++]);
				uint256 n = uint8(req.ops[i++]);
				if (v.length < x + n) revert Invalid();
				assembly {
					v := add(v, x)
					mstore(v, n)
				}
				stack[stackIndex-1] = v;
			} else if (op == OP_STACK_KECCAK) {
				stack[stackIndex-1] = abi.encodePacked(keccak256(stack[stackIndex-1]));
			} else if (op == OP_STACK_CONCAT) {
				stack[stackIndex-2] = abi.encodePacked(stack[stackIndex-2], stack[stackIndex-1]);
				--stackIndex;
			} else {
				revert Invalid();
			}
		}
	}

}