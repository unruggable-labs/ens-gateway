pragma solidity ^0.8.23;

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
		r.collect_first(step); // #0
		fetch(_verifier, r, this.echoCallback.selector, ''); // this.collect_first_callback.selector, '');
	}

	// function collect_first_callback(bytes[] memory values, bytes memory) external pure returns (bytes memory) {
	// 	return values[0];
	// }

	function stack_first(uint256[] memory slots) external view returns (bytes[] memory) {
		GatewayRequest memory r = EVMFetcher.create();
		r.push(address(0x0f1449C980253b576aba379B11D453Ac20832a89)); // TeamNickPointer
		r.target();
		for (uint256 i; i < slots.length; i += 1) {
			r.push(slots[i]); r.add(); r.collect(0);
		}
		for (uint8 i; i < slots.length; i += 1) {
			r.push_output(i); // TODO: ux should this be uint256 but error on overflow?
		}
		r.push_str('');
		r.first(); r.target();
		r.push(9); r.add(); r.collect(1); // #N (9 = baseURI string)
		fetch(_verifier, r, this.echoCallback.selector, ''); //, this.stack_first_callback.selector, abi.encode(slots.length));
	}

	// function stack_first_callback(bytes[] memory values, bytes memory carry) external pure returns (uint256) {
	// 	(uint256 n) = abi.decode(carry, (uint256));
	// 	return uint256(bytes32(values[n]));
	// }

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