// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {GatewayRequest} from "./EVMFetcher.sol";
import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {SecureMerkleTrie} from "../trie-with-nonexistance/SecureMerkleTrie.sol";

struct StateProof {
    bytes[] stateTrieWitness;         // Witness proving the `storageRoot` against a state root.
    bytes[][] storageProofs;          // An array of proofs of individual storage elements 
}

uint8 constant FLAG_DYNAMIC = 0x01;

uint8 constant OP_PATH_START = 1;
uint8 constant OP_PATH_END = 9;
uint8 constant OP_PUSH = 3;
uint8 constant OP_PUSH_OUTPUT = 8;
uint8 constant OP_PUSH_BYTE = 7;
uint8 constant OP_SLOT_ADD = 4;
uint8 constant OP_SLOT_FOLLOW = 5;
uint8 constant OP_STACK_KECCAK = 6;
uint8 constant OP_STACK_SLICE = 10;


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
        //bytes memory value = getSingleStorageProof(storageRoot, slot, witness);
        // RLP encoded storage slots are stored without leading 0 bytes.
        // Casting to bytes32 appends trailing 0 bytes, so we have to bit shift to get the 
        // original fixed-length representation back.
        //return bytes32(value) >> (256 - 8 * value.length);
		return _toUint256(getSingleStorageProof(storageRoot, slot, witness));
    }

	function proveOutput(bytes32 storageRoot, bytes[][] memory storageProofs, uint256 slot, uint256 step) internal pure returns (bytes memory v) {
		uint256 first = getStorage(storageRoot, slot, storageProofs[0]);
		if (step == 0) return abi.encode(first);
		uint256 size;
		if (step == 1 && (first & 1) == 0) {
			size = (first & 0xFF) >> 1;
			v = new bytes(size);
			if (size > 0) assembly { mstore(add(v, 32), shl(sub(32, size), first)) }
		}
		first >>= 1;
		size = first * step;
		slot = uint256(keccak256(abi.encode(slot)));
		v = new bytes(size);
		uint256 i;
		while (i < first) {
			i += 1;
			uint256 value = getStorage(storageRoot, slot, storageProofs[i]);
			assembly { mstore(add(v, shl(5, i)), value) }
		}
	}

	function _toUint256(bytes memory v) internal pure returns (uint256) {
		return uint256(v.length < 32 ? bytes32(v) >> ((32 - v.length) << 3) : bytes32(v));
	}

	function getStorageValues(GatewayRequest memory req, bytes32 stateRoot, StateProof[] memory proofs) internal pure returns(bytes[] memory outputs) {
		outputs = new bytes[](req.outputs);
		uint256 slot;
		bytes[] memory stack = new bytes[](16);
		uint256 stackIndex;
		uint256 outputIndex;
		bytes32 storageRoot;
		for (uint256 i; i < req.ops.length; ) {
			uint256 op = uint8(req.ops[i++]);
			if (op == OP_PATH_START) {
				storageRoot = getStorageRoot(
					stateRoot, 
					address(uint160(_toUint256(stack[--stackIndex]))), 
					proofs[outputIndex].stateTrieWitness
				);
			} else if (op == OP_PATH_END) {
				outputs[outputIndex] = proveOutput(
					storageRoot, 
					proofs[outputIndex].storageProofs, 
					slot, 
					uint8(req.ops[i++])
				);
				slot = 0;
				outputIndex++;
			} else if (op == OP_PUSH) {
				stack[stackIndex++] = abi.encodePacked(req.inputs[uint8(req.ops[i++])]);
			} else if (op == OP_PUSH_BYTE) {
				stack[stackIndex++] = abi.encode(uint8(req.ops[i++]));
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
			} else {
				revert Invalid();
			}
		}
	}

}