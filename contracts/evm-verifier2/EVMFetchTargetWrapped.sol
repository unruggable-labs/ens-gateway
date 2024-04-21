//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { IEVMVerifier } from "./IEVMVerifier.sol";

/**
 * @dev Callback implementation for users of `EVMFetcher`. If you use `EVMFetcher`, your contract must
 *      inherit from this contract in order to handle callbacks correctly.
 */
abstract contract EVMFetchTarget {

    error ResponseLengthMismatch(uint256 actual, uint256 expected);

    /**
     * @dev Internal callback function invoked by CCIP-Read in response to a `getStorageSlots` request.
     */
    function getStorageSlotsCallback(bytes calldata response, bytes calldata carry) external view returns (bytes memory) {
		bytes memory proof = abi.decode(response, (bytes));
        (
			IEVMVerifier verifier,
			bytes memory context,
			address addr, 
			bytes32[] memory commands, 
			bytes[] memory constants, 
			bytes4 callback, 
			bytes memory callbackData
		) = abi.decode(carry, (IEVMVerifier, bytes, address, bytes32[], bytes[], bytes4, bytes));
		bytes[] memory values = verifier.getStorageValues(context, addr, commands, constants, proof);
		if(values.length != commands.length) {
			revert ResponseLengthMismatch(values.length, commands.length);
		}
		(bool ok, bytes memory ret) = address(this).staticcall(abi.encodeWithSelector(callback, values, callbackData));
		if (!ok) assembly { revert(add(ret, 32), mload(ret)) } 
		if (ret.length == 0) ret = new bytes(64);
		return ret;
	}
}
