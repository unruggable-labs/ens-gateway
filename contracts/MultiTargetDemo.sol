/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {EVMFetcher} from './evm-verifier3/EVMFetcher.sol';
import {EVMFetchTarget} from './evm-verifier3/EVMFetchTarget.sol';
import {IEVMVerifier} from './evm-verifier3/IEVMVerifier.sol';

contract MultiTargetDemo is EVMFetchTarget {
	using EVMFetcher for EVMFetcher.Req;

	IEVMVerifier immutable verifier;

	constructor(address _verifier) {
		verifier = IEVMVerifier(_verifier);
	}

	function debug() external pure returns (bytes memory) {
		EVMFetcher.Req memory r = EVMFetcher.create();
		r.push(0x0f1449C980253b576aba379B11D453Ac20832a89); r.start(); r.end(0); //r.push(0); r.add();
		r.ref(0); r.start(); r.push(8); r.add(); r.end(0);
		r.ref(0); r.start(); r.push(9); r.add(); r.end(1);
		return r.debug();
	}

	// function multi() external view returns (bytes32, bytes32) {
	// 	EVMFetcher.Req memory r = EVMFetcher.create();
	// 	r.push(0x0f1449C980253b576aba379B11D453Ac20832a89); r.getSlot(); //r.push(0); r.add();
	// 	r.ref(0); r.align(0); r.push(8); r.add();
	// 	r.ref(0); r.align(1); r.push(9); r.add();
	// 	r.fetch(verifier, this.multiCallback.selector, ''); 
	// }

	function multiCallback(bytes[] calldata values, bytes calldata) external pure returns (bytes32 a, bytes32 b, string memory c) {
		a = bytes32(values[0]);
		b = bytes32(values[1]);
		c = string(values[2]);
	}

} 