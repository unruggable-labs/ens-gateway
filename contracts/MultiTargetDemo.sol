/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {GatewayRequest} from "./evm-verifier3/GatewayRequest.sol";
import {EVMFetcher} from "./evm-verifier3/EVMFetcher.sol";
import {EVMFetchTarget2} from "./evm-verifier3/EVMFetchTarget2.sol";
//import {EVMFetchTarget} from "./evm-verifier3/EVMFetchTarget.sol";
import {IEVMVerifier} from "./evm-verifier3/IEVMVerifier.sol";

contract MultiTargetDemo is EVMFetchTarget2 {
	using EVMFetcher for GatewayRequest;

	IEVMVerifier immutable verifier;

	constructor(address _verifier) {
		verifier = IEVMVerifier(_verifier);
	}

	address constant TEAMNICK_POINTER = 0x0f1449C980253b576aba379B11D453Ac20832a89;

	function teamnick() external view returns (address, uint256, string memory, address, string memory) {
		GatewayRequest memory r = EVMFetcher.create();
		uint256 token = uint256(keccak256(bytes("raffy")));
		r.push(TEAMNICK_POINTER); r.target(); r.collect(0);
		r.push_output(0); r.target(); 
		r.push(8); r.add(); r.collect(0);
		r.push(9); r.add(); r.collect(1);
		r.push(7); r.add(); r.push(token); r.follow(); r.collect(0);
		r.push(7); r.add(); r.push(token); r.follow(); r.push(1); r.add(); r.collect(1);
		fetch(verifier, r, this.teamnickCallback.selector, '');
	}

	function teamnickCallback(bytes[] calldata values, bytes calldata) external pure returns (bytes32 a, bytes32 b, string memory c, bytes32 d, string memory e) {
		a = bytes32(values[0]);
		b = bytes32(values[1]);
		c = string(values[2]);
		d = bytes32(values[3]); //address(uint160(uint256(bytes32(values[3]))));
		e = string(values[4]);
	}

	address constant CYPHER_NFT = 0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d;
	uint256 constant SLOT_OWNERS  =  2; // mapping(uint256 tokenId => address) private _owners;
	uint256 constant SLOT_SUPPLY  =  7;
	uint256 constant SLOT_TEXTS   = 10; // mapping(bytes32 => mapping(string => string)) _texts;
	uint256 constant SLOT_ADDRS   = 11; // mapping(bytes32 => mapping(uint256 => bytes)) _addrs;
	uint256 constant SLOT_CHASHES = 12; // mapping(bytes32 => bytes) _chashes;
	uint256 constant SLOT_NAMES   = 13; // mapping(uint256 => string) _names;

	function cypher() external view returns (address, bytes memory, string memory) {
		GatewayRequest memory r = EVMFetcher.create();
		uint256 token = uint256(keccak256(bytes("slobo")));
		r.push(CYPHER_NFT); r.target();
		r.push(SLOT_OWNERS); r.add(); r.push(token); r.follow(); r.collect(0);
		r.push(SLOT_ADDRS); r.add(); r.push(token); r.push_output(0); r.slice(12, 20); r.concat(); r.keccak(); r.follow(); r.push(60); r.follow(); r.collect(1);
		r.push(SLOT_TEXTS); r.add(); r.push(token); r.push_output(0); r.slice(12, 20); r.concat(); r.keccak(); r.follow(); r.push(bytes("com.twitter")); r.follow(); r.collect(1);
		fetch(verifier, r, this.cypherCallback.selector, '');
	}

	function cypherCallback(bytes[] calldata values, bytes calldata) external pure returns (bytes32 owner, bytes memory addr60, bytes memory twitter) {
		owner = bytes32(values[0]);
		addr60 = values[1];
		twitter = values[2];
	}

} 