/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IExtendedResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";

import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {Hashing, Types} from "@eth-optimism/contracts-bedrock/src/libraries/Hashing.sol";

//import {SecureMerkleTrie} from "@eth-optimism/contracts-bedrock/src/libraries/trie/SecureMerkleTrie.sol";
import {SecureMerkleTrie} from "./trie-with-nonexistance/SecureMerkleTrie.sol";

// https://eips.ethereum.org/EIPS/eip-3668
error OffchainLookup(address from, string[] urls, bytes request, bytes4 callback, bytes carry);

interface IL2OutputOracle {
	function getL2Output(uint256 outputIndex) external view returns (Types.OutputProposal memory);
}

struct StateProof {
	bytes[] accountWitness;
	bytes[][] storageWitnesses;
}

interface ISingleSlotProver {
	function prove(address target, uint256 slot) external returns (uint256 outputIndex, Types.OutputRootProof memory outputRootProof, StateProof memory stateProof);
}

contract SingleSlotDemo {
	
	error OutputRootMismatch(uint256 l2OutputIndex, bytes32 expected, bytes32 actual);
	error AccountNotFound(address);

	string[] gateways;
	IL2OutputOracle immutable oracle;

	constructor(string[] memory _gateways, IL2OutputOracle _oracle) {
		gateways = _gateways;
		oracle = _oracle;
	}

	function prove(address target, uint256 slot) external view returns (bytes32) {
		revert OffchainLookup(
			address(this), 
			gateways, 
			abi.encodeCall(ISingleSlotProver.prove, (target, slot)), 
			this.proveCallback.selector,
			abi.encode(target, slot)
		);
	}

	function proveCallback(bytes calldata response, bytes calldata carry) external view returns (bytes32) {
		(address target, uint256 slot) = abi.decode(carry, (address, uint256));
		(uint256 outputIndex, Types.OutputRootProof memory outputRootProof, StateProof memory stateProof) = abi.decode(response, (uint256, Types.OutputRootProof, StateProof));
		Types.OutputProposal memory proposal = oracle.getL2Output(outputIndex);
		bytes32 expectedRoot = Hashing.hashOutputRootProof(outputRootProof);
		// bytes32 expectedRoot = keccak256(abi.encode(
		// 	outputRootProof.version,
		// 	outputRootProof.stateRoot,
		// 	outputRootProof.messagePasserStorageRoot,
		// 	outputRootProof.latestBlockhash
		// ));
		if (expectedRoot != proposal.outputRoot) {
			revert OutputRootMismatch(outputIndex, expectedRoot, proposal.outputRoot);
		}
		bytes32 storageRoot = getStorageRoot(outputRootProof.stateRoot, target, stateProof.accountWitness);
		bytes32 slotValue = getStorageSlot(storageRoot, slot, stateProof.storageWitnesses[0]);
		return slotValue;
	}

	function getStorageRoot(bytes32 stateRoot, address target, bytes[] memory witness) private pure returns (bytes32) {
		(bool exists, bytes memory rlpAccount) = SecureMerkleTrie.get(abi.encodePacked(target), witness, stateRoot);
		if (!exists) revert AccountNotFound(target);
		RLPReader.RLPItem[] memory accountState = RLPReader.readList(rlpAccount);
		return bytes32(RLPReader.readBytes(accountState[2]));
	}

	 function getStorageSlot(bytes32 storageRoot, uint256 slot, bytes[] memory witness) private pure returns (bytes32) {
		(bool exists, bytes memory rlpValue) = SecureMerkleTrie.get(abi.encodePacked(slot), witness, storageRoot);
		if (!exists) return 0;
		bytes memory v = RLPReader.readBytes(rlpValue);
		return bytes32(v) >> (256 - (v.length << 3));
	}

} 