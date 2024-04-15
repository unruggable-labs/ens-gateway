/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {EVMFetcher} from './evm-verifier/EVMFetcher.sol';
import {EVMFetchTarget} from './evm-verifier/EVMFetchTarget.sol';
import {IEVMVerifier} from './evm-verifier/IEVMVerifier.sol';

contract FetchTest is EVMFetchTarget {
	using EVMFetcher for EVMFetcher.EVMFetchRequest;

	IEVMVerifier immutable verifier;

	address constant TEAMNICK_ADDRESS = 0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f;

	constructor(IEVMVerifier _verifier) {
		verifier = _verifier;
	}

	function name() external view returns (string memory) {
		EVMFetcher.newFetchRequest(verifier, TEAMNICK_ADDRESS).getDynamic(0).fetch(this.nameCallback.selector, ''); 
	}
	function nameCallback(bytes[] memory values, bytes memory) external pure returns (string memory) {
		return string(values[0]);
	}

	function supply() external view returns (uint256) {
		EVMFetcher.newFetchRequest(verifier, TEAMNICK_ADDRESS).getStatic(8).fetch(this.supplyCallback.selector, '');
	}
	function supplyCallback(bytes[] memory values, bytes memory) external pure returns (uint256) {
		return uint256(bytes32(values[0]));
	}

} 