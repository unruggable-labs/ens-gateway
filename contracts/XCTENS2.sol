/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

// interfaces
import {IEVMVerifier} from "./evm-verifier2/IEVMVerifier.sol";
import {IAddrResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";
import {ITextResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol";
import {IContentHashResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IContentHashResolver.sol";

// libraries
import {BytesUtils} from "@ensdomains/ens-contracts/contracts/wrapper/BytesUtils.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EVMFetcher} from "./evm-verifier2/EVMFetcher.sol";

// bases
import {EVMFetchTarget} from "./evm-verifier2/EVMFetchTarget.sol";
import {SubExtResolver} from "./SubExtResolver.sol";

contract XCTENS2 is SubExtResolver, EVMFetchTarget {
	using BytesUtils for bytes;
	using EVMFetcher for EVMFetcher.EVMFetchRequest;

	IEVMVerifier immutable verifier;
	address immutable xctens;
	uint256 immutable chain;

	uint256 constant CTY_EVM = uint256(keccak256(bytes("universal")));

	uint256 constant SLOT_OWNERS  =  2; // mapping(uint256 tokenId => address) private _owners;
	uint256 constant SLOT_SUPPLY  =  7;
	uint256 constant SLOT_TEXTS   = 10; // mapping(bytes32 => mapping(string => string)) _texts;
	uint256 constant SLOT_ADDRS   = 11; // mapping(bytes32 => mapping(uint256 => bytes)) _addrs;
	uint256 constant SLOT_CHASHES = 12; // mapping(bytes32 => bytes) _chashes;
	uint256 constant SLOT_NAMES   = 13; // mapping(uint256 => string) _names;

	constructor(address ens, address _verifier, address _xctens, uint256 _chain) SubExtResolver(ens) {
		verifier = IEVMVerifier(_verifier);
		xctens = _xctens;
		chain = _chain;
	}

	function _replaceNode(bytes memory v, bytes32 node) internal pure returns (bytes memory) {
		assembly { mstore(add(v, 36), node) }
		return v;
	}

	function _resolve(bytes32 node, bytes memory label, bytes calldata request) internal override view returns (bytes memory) {
		if (label.length == 0) return _resolveBasename(node, request);
		bytes32 token = keccak256(bytes(label));
		EVMFetcher.EVMFetchRequest memory req = EVMFetcher.newFetchRequest(verifier, xctens);
		req.getStatic(SLOT_OWNERS).element(token);
		req.fetch(this.ownerCallback.selector, _replaceNode(request, token)); // replace node with token
	}

	function ownerCallback(bytes[] calldata values, bytes calldata carry) external view returns (bytes memory v) {
		address owner = address(bytes20(values[0][12:]));
		if (owner == address(0)) return '';
		EVMFetcher.EVMFetchRequest memory req = EVMFetcher.newFetchRequest(verifier, xctens);
		bytes32 node = keccak256(abi.encodePacked(carry[4:36], owner)); 
		bytes4 selector = bytes4(carry);
		if (selector == IAddrResolver.addr.selector) {
			_fetch_addr(req, node, 60);
		} else if (selector == IAddressResolver.addr.selector) {
			uint256 cty = uint256(bytes32(carry[36:]));
			_fetch_addr(req, node, cty);
		} else if (selector == ITextResolver.text.selector) {
			(, string memory key) = abi.decode(carry[4:], (bytes32, string));
			bytes32 keyhash = keccak256(bytes(key));
			if (keyhash == keccak256(bytes("owner"))) {
				return abi.encode(string.concat("eip155:", Strings.toString(chain), ":", Strings.toHexString(owner)));
			} else {
				req.getDynamic(SLOT_TEXTS).element(node).element(key);
			}
		} else if (selector == IContentHashResolver.contenthash.selector) {
			req.getDynamic(SLOT_CHASHES).element(node);
		} else {
			return new bytes(64);
		}
		req.fetch(this.resolveCallback.selector, abi.encode(selector));
	}
	function _fetch_addr(EVMFetcher.EVMFetchRequest memory req, bytes32 node, uint256 cty) internal pure {
		req.getDynamic(SLOT_ADDRS).element(node).element(cty);
		if ((cty == 60 || (cty & 0x80000000) != 0) && cty != CTY_EVM) {
			req.getDynamic(SLOT_ADDRS).element(node).element(CTY_EVM);
		}
	}
	function resolveCallback(bytes[] calldata values, bytes calldata carry) external pure returns (bytes memory) {
		bytes4 selector = abi.decode(carry, (bytes4));
		if (selector == IAddrResolver.addr.selector) {
			bytes memory v = values[0];
			if (v.length == 0 && values.length == 2) v = values[1];
			return abi.encode(address(bytes20(v)));
		} else if (selector == IAddressResolver.addr.selector) {
			bytes memory v = values[0];
			if (v.length == 0 && values.length == 2) v = values[1];
			return abi.encode(v);
		} else if (selector == ITextResolver.text.selector || selector == IContentHashResolver.contenthash.selector) {
			return abi.encode(values[0]);
		}
		return new bytes(64);
	}

	function _resolveBasename(bytes32 node, bytes calldata request) internal view returns (bytes memory) {
		bytes4 selector = bytes4(request);
		if (selector == IAddressResolver.addr.selector) {
			uint256 cty = uint256(bytes32(request[36:]));
			if (cty == (0x80000000 | chain)) {
				return abi.encode(abi.encodePacked(xctens));
			}
		} else if (selector == ITextResolver.text.selector) {
			(, string memory key) = abi.decode(request[4:], (bytes32, string));
			bytes32 keyhash = keccak256(bytes(key));
			if (keyhash == keccak256(bytes("description"))) {
				EVMFetcher.newFetchRequest(verifier, xctens).getStatic(SLOT_SUPPLY).fetch(this.descriptionCallback.selector, '');
			}
		}
		bytes32 basenode = keccak256(abi.encode(node, keccak256(bytes("_"))));
		address resolver = ens.resolver(basenode);
		if (resolver != address(0)) {
			(bool ok, bytes memory v) = resolver.staticcall(_replaceNode(request, basenode));
			if (ok) return v;
		}
		return new bytes(64);
	}
	function descriptionCallback(bytes[] calldata values, bytes calldata) external pure returns (bytes memory) {
		return abi.encode(string.concat(Strings.toString(uint256(bytes32(values[0]))), " names registered"));
	}
	
} 
