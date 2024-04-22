// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IEVMGateway {
	function fetch(
		bytes memory context, 
		uint16 outputs,
		bytes memory ops, 
		bytes[] memory inputs
	) external pure returns (bytes memory witness);
}
