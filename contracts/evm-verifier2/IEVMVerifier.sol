//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IEVMVerifier {
	function getStorageContext() external view returns(string[] memory urls, bytes memory context);
	function getStorageValues(bytes memory context, address target, bytes32[] memory commands, bytes[] memory constants, bytes memory proof) external view returns(bytes[] memory values);
}
