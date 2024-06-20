// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import "forge-std/console2.sol";

import "../../contracts/evm-verifier4/EVMFetcher.sol";

contract Test_EVMRequest is Test {

	using EVMFetcher for EVMRequest;

	function test1() public pure {

		EVMRequest memory r = EVMFetcher.newRequest(2);

		r.push(EVMFetcher.newCommand().push(1).pop());

		console2.logBytes(abi.encode(r));

	}

}
