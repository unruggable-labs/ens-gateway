// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IEVMVerifier} from "./IEVMVerifier.sol";
import {StateProof, EVMProofHelper} from "./EVMProofHelper.sol";
import {Node, IRollupCore} from "@arbitrum/nitro-contracts/src/rollup/IRollupCore.sol";
import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";

contract Arb1Verifier is IEVMVerifier {

	error Mismatch(uint64 node, bytes32 computed, bytes32 actual);

	string[] public gatewayURLs;
	IRollupCore immutable rollup;

	constructor(string[] memory _urls, IRollupCore _rollup) {
		gatewayURLs = _urls;
		rollup = _rollup;
	}

	function getStorageContext() external view returns(string[] memory urls, bytes memory context) {
		urls = gatewayURLs;
		context = abi.encode(rollup.latestNodeCreated());
	}

	function getStorageValues(bytes memory context, address target, bytes32[] memory commands, bytes[] memory constants, bytes memory proof) external view returns(bytes[] memory values) {
		uint64 nodeNum = abi.decode(context, (uint64));
		(bytes32 sendRoot, bytes memory rlpEncodedBlock, StateProof memory stateProof) = abi.decode(proof, (bytes32, bytes, StateProof));
		Node memory node = rollup.getNode(nodeNum);
 		bytes32 confirmData = keccak256(abi.encodePacked(keccak256(rlpEncodedBlock), sendRoot));
		if (confirmData != node.confirmData) revert Mismatch(nodeNum, confirmData, node.confirmData);
		bytes32 stateRoot = getStateRootFromBlock(rlpEncodedBlock);
		return EVMProofHelper.getStorageValues(target, commands, constants, stateRoot, stateProof);
	}

	 function getStateRootFromBlock(bytes memory rlpEncodedBlock) internal pure returns (bytes32) {
		RLPReader.RLPItem[] memory v = RLPReader.readList(rlpEncodedBlock);
		return bytes32(RLPReader.readBytes(v[3]));
	}

}
