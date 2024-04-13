/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IExtendedResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";

// https://eips.ethereum.org/EIPS/eip-3668
error OffchainLookup(address from, string[] urls, bytes request, bytes4 callback, bytes carry);

interface SingleSlotProver {
	function prove(address target, bytes32 slot) external returns (uint256 outputIndex, uint256 blockNumber, bytes32 blockRoot, bytes32 blockHash, bytes32 passerRoot, bytes memory accountProof, bytes[][] memory slotProof);
}

contract SingleSlotRelay {

	string[] public gateways;

	constructor(string[] memory _gateways) {
		gateways = _gateways;
	}

	function prove(address target, bytes32 slot) external view {
		revert OffchainLookup(
			address(this), 
			gateways, 
			abi.encodeCall(SingleSlotProver.prove, (target, slot)), 
			this.proveCallback.selector,
			abi.encode(target, slot)
		);
	}

	function proveCallback(bytes calldata response, bytes calldata carry) external view {
		(address target, bytes32 slot) = abi.decode(carry, (address, bytes32));


	}

} 