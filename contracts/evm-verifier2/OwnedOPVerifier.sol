// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import { IEVMVerifier } from "./IEVMVerifier.sol";
import { StateProof, EVMProofHelper } from "./EVMProofHelper.sol";

import { RLPReader } from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {Hashing, Types} from "@eth-optimism/contracts-bedrock/src/libraries/Hashing.sol";


interface IL2OutputOracle {
	function latestOutputIndex() external view returns (uint256);
	function getL2Output(uint256 _l2OutputIndex) external view returns (Types.OutputProposal memory);
}

contract OwnedOPVerifier is IEVMVerifier, Ownable {

	event GatewayConfigChanged(string[] urls, uint256 delay);

	error OutputRootMismatch(uint256 l2OutputIndex, bytes32 expected, bytes32 actual);

	IL2OutputOracle immutable oracle;

	string[] public gatewayURLs;
	uint256 public delay;

	constructor(IL2OutputOracle _oracle, string[] memory urls, uint256 _delay) Ownable(msg.sender) {
		oracle = _oracle;
		setGatewayConfig(urls, _delay);
	}

	function setGatewayConfig(string[] memory urls, uint256 _delay) onlyOwner public {
		gatewayURLs = urls;
		delay = _delay;
		emit GatewayConfigChanged(urls, _delay);
	}

	function getStorageContext() external view returns(string[] memory urls, bytes memory context) {
		urls = gatewayURLs;
		context = abi.encode(oracle.latestOutputIndex() - delay);
	}

	function getStorageValues(bytes memory context, address target, bytes32[] memory commands, bytes[] memory constants, bytes memory proof) external view returns(bytes[] memory values) {
		uint256 outputIndex = abi.decode(context, (uint256));
		(Types.OutputRootProof memory outputRootProof, StateProof memory stateProof) = abi.decode(proof, (Types.OutputRootProof, StateProof));
		Types.OutputProposal memory l2out = oracle.getL2Output(outputIndex);
		bytes32 expectedRoot = Hashing.hashOutputRootProof(outputRootProof);
		if (l2out.outputRoot != expectedRoot) revert OutputRootMismatch(outputIndex, expectedRoot, l2out.outputRoot);
		return EVMProofHelper.getStorageValues(target, commands, constants, outputRootProof.stateRoot, stateProof);
	}

}
