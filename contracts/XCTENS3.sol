/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

// interfaces
import {IEVMVerifier} from "./evm-verifier3/IEVMVerifier.sol";
import {IAddrResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";
import {ITextResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol";
import {IContentHashResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IContentHashResolver.sol";

// libraries
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
//import {GatewayRequest} from "./evm-verifier3/GatewayRequest.sol";
//import {EVMFetcher} from "./evm-verifier3/EVMFetcher.sol";
import "./evm-verifier3/EVMFetcher.sol";

// bases
import {EVMFetchTarget2} from "./evm-verifier3/EVMFetchTarget2.sol";
import {SubExtResolver} from "./SubExtResolver.sol";

contract XCTENS3 is SubExtResolver, EVMFetchTarget2 {
	using EVMFetcher for GatewayRequest;
	
	IEVMVerifier immutable _verifier;

	address immutable _xctens;
	uint256 immutable _chain;

	uint256 constant CTY_ETH = 60;
	uint256 constant CTY_EVM = uint256(keccak256(bytes("universal")));

	bytes4 constant SEL_OWNER = 0x00000001;

	uint256 constant SLOT_OWNERS  =  2; // mapping(uint256 tokenId => address) private _owners;
	uint256 constant SLOT_SUPPLY  =  7;
	uint256 constant SLOT_TEXTS   = 10; // mapping(bytes32 => mapping(string => string)) _texts;
	uint256 constant SLOT_ADDRS   = 11; // mapping(bytes32 => mapping(uint256 => bytes)) _addrs;
	uint256 constant SLOT_CHASHES = 12; // mapping(bytes32 => bytes) _chashes;
	uint256 constant SLOT_NAMES   = 13; // mapping(uint256 => string) _names;

	constructor(address ens, address verifier, address xctens, uint256 chain) SubExtResolver(ens) {
		_verifier = IEVMVerifier(verifier);
		_xctens = xctens;
		_chain = chain;
	}

	function _resolve(bytes32 node, bytes memory label, bytes calldata request) internal override view returns (bytes memory) {
		if (label.length == 0) return _resolveBasename(node, request);
		uint256 token = uint256(keccak256(bytes(label)));
		GatewayRequest memory r = EVMFetcher.create();
		r.push(_xctens); r.target();
		r.push(SLOT_OWNERS); r.add(); r.push(token); r.follow(); r.collect(0);
		bytes4 selector = bytes4(request);
		if (selector == IAddrResolver.addr.selector) {
			_fetch_addr(r, token, CTY_ETH);
		} else if (selector == IAddressResolver.addr.selector) {
			uint256 cty = uint256(bytes32(request[36:]));
			_fetch_addr(r, token, cty);
		} else if (selector == ITextResolver.text.selector) {
			(, string memory key) = abi.decode(request[4:], (bytes32, string));
			bytes32 keyhash = keccak256(bytes(key));
			if (keyhash == keccak256(bytes("owner"))) {
				selector = SEL_OWNER;
			} else {
				_prepare_node(r, SLOT_TEXTS, token); r.push(bytes(key)); r.follow(); r.collect(1);
			}
		} else if (selector == IContentHashResolver.contenthash.selector) {
			_prepare_node(r, SLOT_CHASHES, token); r.collect(1);
		} else {
			return new bytes(64);
		}
		fetch(_verifier, r, this.resolveCallback.selector, abi.encode(selector, request));
	}
	function _prepare_node(GatewayRequest memory r, uint256 slot, uint256 token) internal pure {
		// mapping(bytes32 => bytes) _chashes;
		// mapping(bytes32 => mapping(string => string)) _texts;
		// mapping(bytes32 => mapping(uint256 => bytes)) _addrs;
		// function _tokenFromLabel(string memory label) internal pure returns (uint256) {
		//     return uint256(keccak256(abi.encodePacked(label)));
		// }
		// function _node(uint256 token) internal view returns (bytes32) {
		//     return keccak256(abi.encodePacked(_ownerOf(token), token));
		// }
		r.push(slot); r.add(); r.push(token); r.push_output(0); r.slice(12, 20); r.concat(2); r.keccak(); r.follow(); 
	}
	function _fetch_addr(GatewayRequest memory r, uint256 token, uint256 cty) internal pure {
		_prepare_node(r, SLOT_ADDRS, token); r.push(cty); r.follow(); r.collect(1);
		if (cty == CTY_ETH || (cty & 0x80000000) != 0) { // CTY_EVM is not EVM
			_prepare_node(r, SLOT_ADDRS, token); r.push(CTY_EVM); r.follow(); r.collect(1);
		}
	}
	function resolveCallback(bytes[] calldata values, bytes calldata carry) external view returns (bytes memory) {
		(bytes4 selector, /*bytes memory request*/) = abi.decode(carry, (bytes4, bytes));
		if (selector == IAddrResolver.addr.selector) {
			bytes memory v = values[1];
			if (v.length == 0 && values.length == 3) v = values[2];
			return abi.encode(address(bytes20(v)));
		} else if (selector == IAddressResolver.addr.selector) {
			bytes memory v = values[1];
			if (v.length == 0 && values.length == 3) v = values[2];
			return abi.encode(v);
		} else if (selector == ITextResolver.text.selector || selector == IContentHashResolver.contenthash.selector) {
			return abi.encode(values[1]);
		} else if (selector == SEL_OWNER) {
			return abi.encode(string.concat("eip155:", Strings.toString(_chain), ":", Strings.toHexString(uint256(bytes32(values[0])), 20)));
		}
		return new bytes(64);
	}

	function _resolveBasename(bytes32 node, bytes calldata request) internal view returns (bytes memory) {
		bytes4 selector = bytes4(request);
		if (selector == IAddressResolver.addr.selector) {
			uint256 cty = uint256(bytes32(request[36:]));
			if (cty == CTY_ETH) {
				return abi.encode(abi.encodePacked(address(this)));
			} else if (cty == (0x80000000 | _chain)) {
				return abi.encode(abi.encodePacked(_xctens));
			}
		} else if (selector == ITextResolver.text.selector) {
			(, string memory key) = abi.decode(request[4:], (bytes32, string));
			bytes32 keyhash = keccak256(bytes(key));
			if (keyhash == keccak256(bytes("description"))) {
				GatewayRequest memory r = EVMFetcher.create();
				r.push(_xctens); r.target();
				r.push(SLOT_SUPPLY); r.add(); r.collect(0);
				fetch(_verifier, r, this.descriptionCallback.selector, '');
			}
		}
		bytes32 basenode = keccak256(abi.encode(node, keccak256(bytes("_"))));
		address resolver = ens.resolver(basenode);
		if (resolver != address(0)) {
			bytes memory copy = request;
			assembly { mstore(add(copy, 36), basenode) }
			(bool ok, bytes memory v) = resolver.staticcall(copy);
			if (ok) return v;
		}
		return new bytes(64);
	}
	function descriptionCallback(bytes[] calldata values, bytes calldata) external pure returns (bytes memory) {
		return abi.encode(string.concat(Strings.toString(uint256(bytes32(values[0]))), " names registered"));
	}
	
} 
