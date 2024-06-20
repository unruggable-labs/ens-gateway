// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {EVMRequest} from "./EVMProtocol.sol";

interface IEVMVerifier {
	
	error OutputRootMismatch(bytes context, bytes32 expected, bytes32 actual);

	function getStorageContext() external view returns(string[] memory urls, bytes memory context);
	
	function getStorageValues(
		bytes memory context,
		EVMRequest memory req,
		bytes memory proof
	) external view returns (bytes[] memory values, uint8 exitCode);

}

