/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IEVMVerifier} from "./evm-verifier2/IEVMVerifier.sol";
import {EVMFetcher} from "./evm-verifier2/EVMFetcher.sol";
import {EVMFetchTarget} from "./evm-verifier2/EVMFetchTarget.sol";

contract Fetcher2 is EVMFetchTarget {
	using EVMFetcher for EVMFetcher.EVMFetchRequest;

	IEVMVerifier immutable verifier;

	constructor(IEVMVerifier _verifier) {
		verifier = _verifier;
	}

	function getBytes32(address target, uint256 slot) external view returns (bytes32) {
		EVMFetcher.newFetchRequest(verifier, target).getStatic(slot).fetch(this.getBytes32Callback.selector, '');
	}
	function getBytes32Callback(bytes[] calldata v, bytes calldata) external pure returns (bytes32) {
		return bytes32(v[0]);
	}

	function getBytes(address target, uint256 slot) external view returns (bytes memory) {
		EVMFetcher.newFetchRequest(verifier, target).getDynamic(slot).fetch(this.getBytesCallback.selector, '');
	}
	function getBytesCallback(bytes[] calldata v, bytes calldata) external pure returns (bytes memory) {
		return v[0];
	}

} 