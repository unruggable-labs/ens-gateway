/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

// interfaces
import {ENS} from "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IEVMVerifier} from "./evm-verifier2/IEVMVerifier.sol";
import {IExtendedResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";
import {IAddrResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";
import {ITextResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol";

// libraries
import {BytesUtils} from "@ensdomains/ens-contracts/contracts/wrapper/BytesUtils.sol";
import {EVMFetcher} from "./evm-verifier2/EVMFetcherNoOZ.sol";

// bases
import {EVMFetchTarget} from "./evm-verifier2/EVMFetchTarget.sol";

contract TeamNick2BaselessNoOZ is IERC165, IExtendedResolver, EVMFetchTarget {
	using BytesUtils for bytes;
	using EVMFetcher for EVMFetcher.EVMFetchRequest;

	error Unreachable(bytes name);

	ENS immutable ens;
	IEVMVerifier immutable verifier;

	uint256 constant SLOT_RECORDS = 7;
	uint256 constant SLOT_SUPPLY = 8;

	address constant TEAMNICK_ADDRESS = 0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f;

	constructor(ENS _ens, IEVMVerifier _verifier) {
		ens = _ens;
		verifier = _verifier;
	}

	function supportsInterface(bytes4 x) external pure returns (bool) {
		return x == type(IERC165).interfaceId || x == type(IExtendedResolver).interfaceId;
	}

	function _resolveBasename(bytes calldata data) internal pure returns (bytes memory) {
		bytes4 selector = bytes4(data);
		if (selector == IAddrResolver.addr.selector) {
			return abi.encode(address(0));
		} else if (selector == IAddressResolver.addr.selector) {
			(, uint256 cty) = abi.decode(data[4:], (bytes32, uint256));
			if (cty == 0x80002105) { // base (8453) {
				return abi.encode(abi.encodePacked(TEAMNICK_ADDRESS));
			}
		} else if (selector == ITextResolver.text.selector) {
			(, string memory key) = abi.decode(data[4:], (bytes32, string));
			bytes32 keyhash = keccak256(bytes(key));
			if (keyhash == 0xb68b5f5089998f2978a1dcc681e8ef27962b90d5c26c4c0b9c1945814ffa5ef0) {
				// https://adraffy.github.io/keccak.js/test/demo.html#algo=keccak-256&s=url&escape=1&encoding=utf8
				return abi.encode("https://teamnick.xyz");
			}
		}
		return abi.encode('');
	}

	function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
		uint256 offset = _findSelf(name);
		if (offset == 0) return _resolveBasename(data);
		(bytes32 label, uint256 pos) = name.readLabel(0);
		uint256 token = pos == offset ? uint256(label) : 0;
		bytes4 selector = bytes4(data);
		if (selector == IAddrResolver.addr.selector) {
			EVMFetcher.newFetchRequest(verifier, TEAMNICK_ADDRESS).getStatic(SLOT_RECORDS).element(token).fetch(this.addrCallback.selector, '');
		} else if (selector == IAddressResolver.addr.selector) {
			(, uint256 cty) = abi.decode(data[4:], (bytes32, uint256));
			if (cty == 60) {
				EVMFetcher.newFetchRequest(verifier, TEAMNICK_ADDRESS).getStatic(SLOT_RECORDS).element(token).fetch(this.addressCallback.selector, '');
			}
		} else if (selector == ITextResolver.text.selector) {
			(, string memory key) = abi.decode(data[4:], (bytes32, string));
			bytes32 keyhash = keccak256(bytes(key));
			if (keyhash == 0x2361458367e696363fbcc70777d07ebbd2394e89fd0adcaf147faccd1d294d60) {
				return abi.encode(name[1:pos]);
			} else if (keyhash == 0xd1f86c93d831119ad98fe983e643a7431e4ac992e3ead6e3007f4dd1adf66343) { 
				// https://adraffy.github.io/keccak.js/test/demo.html#algo=keccak-256&s=avatar&escape=1&encoding=utf8
				EVMFetcher.newFetchRequest(verifier, TEAMNICK_ADDRESS).getDynamic(SLOT_RECORDS).element(token).add(1).fetch(this.textCallback.selector, '');
			}
		}
		return abi.encode('');
	}
	
	function _findSelf(bytes memory name) internal view returns (uint256 offset) {
		unchecked {
			while (true) {
				bytes32 node = name.namehash(offset);
				if (ens.resolver(node) == address(this)) break;
				uint256 size = uint8(name[offset]);
				if (size == 0) revert Unreachable(name);
				offset += 1 + size;
			}
		}
	}

	function addrCallback(bytes[] calldata values, bytes calldata) external pure returns (bytes memory) {
		return abi.encode(bytes32(values[0]));
	}
	function addressCallback(bytes[] calldata values, bytes calldata) external pure returns (bytes memory) {
		return abi.encode(values[0][12:]);
	}
	function textCallback(bytes[] calldata values, bytes calldata) external pure returns (bytes memory) {
		return abi.encode(values[0]);
	}
	
} 