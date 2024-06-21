// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {EVMRequest} from "./EVMProtocol.sol";

interface IEVMVerifier {
	
	function getStorageContext() external view returns(string[] memory urls, bytes memory context);
	
	function getStorageValues(
		bytes memory context,
		EVMRequest memory req,
		bytes memory proof
	) external view returns (bytes[] memory values, uint8 exitCode);

}

