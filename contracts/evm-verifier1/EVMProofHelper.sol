// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {Bytes} from "@eth-optimism/contracts-bedrock/src/libraries/Bytes.sol";

//import {SecureMerkleTrie} from "@eth-optimism/contracts-bedrock/src/libraries/trie/SecureMerkleTrie.sol";
import {SecureMerkleTrie} from "../trie-with-nonexistance/SecureMerkleTrie.sol";

struct StateProof {
    bytes[] stateTrieWitness;         // Witness proving the `storageRoot` against a state root.
    bytes[][] storageProofs;          // An array of proofs of individual storage elements 
}

uint8 constant FLAG_DYNAMIC = 0x01;

library EVMProofHelper {
    using Bytes for bytes;

    error AccountNotFound(address);
    error UnknownOpcode(uint8);
    error InvalidSlotSize(uint256 size);

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

    function getFixedValue(bytes32 storageRoot, uint256 slot, bytes[] memory witness) private pure returns(bytes32) {
        bytes memory value = getSingleStorageProof(storageRoot, slot, witness);
        // RLP encoded storage slots are stored without leading 0 bytes.
        // Casting to bytes32 appends trailing 0 bytes, so we have to bit shift to get the 
        // original fixed-length representation back.
        return bytes32(value) >> (256 - 8 * value.length);
    }


    function computeFirstSlot(bytes32 command, bytes[] memory constants, bytes[] memory values) private pure returns(bool isDynamic, uint256 slot) {
		uint8 flags = uint8(command[0]);
		isDynamic = (flags & FLAG_DYNAMIC) != 0;
		for(uint256 j = 1; j < 32; j++) {
			uint8 op = uint8(command[j]);
			if (op == 0xFF) break;
			uint8 operand = op & 0x1F;
			op >>= 5;
			if (op == 0) {
				slot = uint256(keccak256(abi.encodePacked(constants[operand], slot)));
			} else if (op == 1) {
 				slot = uint256(keccak256(abi.encodePacked(values[operand], slot)));
			} else if (op == 2) {
				slot += uint256(bytes32(constants[operand]));
			} else {
				revert UnknownOpcode(op);
			}
		}
	}

    function getDynamicValue(bytes32 storageRoot, uint256 slot, StateProof memory proof, uint256 proofIdx) private pure returns(bytes memory value, uint256 newProofIdx) {
        uint256 firstValue = uint256(getFixedValue(storageRoot, slot, proof.storageProofs[proofIdx++]));
        if(firstValue & 0x01 == 0x01) {
            // Long value: first slot is `length * 2 + 1`, following slots are data.
            uint256 length = (firstValue - 1) / 2;
            value = "";
            slot = uint256(keccak256(abi.encodePacked(slot)));
            // This is horribly inefficient - O(n^2). A better approach would be to build an array of words and concatenate them
            // all at once, but we're trying to avoid writing new library code.
            while(length > 0) {
                if(length < 32) {
                    value = bytes.concat(value, getSingleStorageProof(storageRoot, slot++, proof.storageProofs[proofIdx++]).slice(0, length));
                    length = 0;
                } else {
                    value = bytes.concat(value, getSingleStorageProof(storageRoot, slot++, proof.storageProofs[proofIdx++]));
                    length -= 32;
                }
            }
            return (value, proofIdx);
        } else {
            // Short value: least significant byte is `length * 2`, other bytes are data.
			uint256 length = (firstValue & 0xFF) / 2;
			return (abi.encode(firstValue).slice(0, length), proofIdx);
        }
    }

    function getStorageValues(address target, bytes32[] memory commands, bytes[] memory constants, bytes32 stateRoot, StateProof memory proof) internal pure returns(bytes[] memory values) {
        bytes32 storageRoot = getStorageRoot(stateRoot, target, proof.stateTrieWitness);
        uint256 proofIdx = 0;
        values = new bytes[](commands.length);
        for(uint256 i = 0; i < commands.length; i++) {
            bytes32 command = commands[i];
            (bool isDynamic, uint256 slot) = computeFirstSlot(command, constants, values);
            if(!isDynamic) {
                values[i] = abi.encode(getFixedValue(storageRoot, slot, proof.storageProofs[proofIdx++]));
                if(values[i].length > 32) {
                    revert InvalidSlotSize(values[i].length);
                }
            } else {
                (values[i], proofIdx) = getDynamicValue(storageRoot, slot, proof, proofIdx);
            }
        }
    }
}