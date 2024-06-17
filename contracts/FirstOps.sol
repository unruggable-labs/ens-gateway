pragma solidity ^0.8.15;

import {IEVMVerifier} from "./evm-verifier3/IEVMVerifier.sol";
import {EVMFetchTarget} from "./evm-verifier3/EVMFetchTarget.sol";
import "./evm-verifier3/EVMFetcher.sol";

contract FirstOps is EVMFetchTarget {

	using EVMFetcher for GatewayRequest;

	IEVMVerifier immutable _verifier;
	constructor(IEVMVerifier verifier) {
		_verifier = verifier;
	}

	function collect_first(address a, uint256[] memory slots, uint8 step) external view returns (bytes[] memory) {
		GatewayRequest memory r = EVMFetcher.create();
		r.push(a);
		r.target();
		for (uint256 i; i < slots.length; i += 1) {
			r.push(slots[i]);
		}
		r.collect_first(step);
		fetch(_verifier, r, this.echoCallback.selector, ''); 
	}

	function stack_first(address a, uint256[] memory slots, uint256 slot, uint8 step) external view returns (bytes[] memory) {
		GatewayRequest memory r = EVMFetcher.create();
		r.push(a);
		r.target();
		for (uint256 i; i < slots.length; i += 1) {
			r.push(slots[i]); r.add(); r.collect(0);
		}
		for (uint8 i; i < slots.length; i += 1) {
			r.push_output(i);
		}
		r.push_str('');
		r.first(); r.target();
		r.push(slot); r.add(); r.collect(step);
		fetch(_verifier, r, this.echoCallback.selector, '');
	}

	function target_first(address[] memory targets, uint256 slot, uint8 step) external view returns (bytes[] memory) {
		GatewayRequest memory r = EVMFetcher.create();
		for (uint256 i; i < targets.length; i += 1) {
			r.push(targets[i]);
		}
		r.target_first();
		r.push(slot);
		r.add();
		r.collect(step);
		fetch(_verifier, r, this.echoCallback.selector, '');
	}

}	