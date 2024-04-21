/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

// interfaces
import {ENS} from "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IExtendedResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";

import {IAddressResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";
import {ITextResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol";
import {IPubkeyResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IPubkeyResolver.sol";

// libraries
import {BytesUtils} from "@ensdomains/ens-contracts/contracts/wrapper/BytesUtils.sol";

abstract contract SubExtResolver is IERC165, IExtendedResolver {
	using BytesUtils for bytes;

	error Unreachable(bytes name);

	ENS immutable ens;

	constructor(address _ens) {
		ens = ENS(_ens);
	}

	function supportsInterface(bytes4 x) external virtual pure returns (bool) {
		return x == type(IERC165).interfaceId || x == type(IExtendedResolver).interfaceId;
	}

	function resolve(bytes memory name, bytes calldata data) external view returns (bytes memory v) {
		(bytes32 node, uint256 pos) = _findSelf(name);
		if (pos == 0) {
			v = _resolve(node, '', data); // basename
		} else {
			uint256 len = uint8(name[0]);
			if (len + 1 == pos) { // exactly one label
				assembly {
					name := add(name, 1) // skip length
					mstore(name, len) // truncate
				}
				v = _resolve(node, name, data);
			}
		}
		if (v.length == 0) {
			v = new bytes(64); //_createNullResponse(bytes4(data));
		}
	}

	/*
	function _createNullResponse(bytes4 selector) internal pure returns (bytes memory) {
		if (selector == IAddressResolver.addr.selector || selector == ITextResolver.text.selector) {
			return abi.encode(''); // 
		} else if (selector == IPubkeyResolver.pubkey.selector) {
			return new bytes(64);
		} else {
			return new bytes(32);
		}
	}
	*/

	function _resolve(bytes32 node, bytes memory label, bytes calldata data) internal view virtual returns (bytes memory) {
		// override me
	}
	
	function _findSelf(bytes memory name) internal view returns (bytes32 node, uint256 offset) {
		unchecked {
			while (true) {
				node = name.namehash(offset);
				if (ens.resolver(node) == address(this)) break;
				uint256 size = uint8(name[offset]);
				if (size == 0) revert Unreachable(name);
				offset += 1 + size;
			}
		}
	}
	
} 

