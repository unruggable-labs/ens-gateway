// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import "forge-std/console2.sol";

import "../../contracts/evm-verifier4/EVMRequestLib.sol";

contract Test_EVMRequest is Test {

	using EVMRequestLib for EVMRequest;

	function test1() public pure {

		EVMRequest memory r = EVMRequestLib.newRequest(2);

		r.push(EVMRequestLib.newCommand().push(1).pop());

		console2.logBytes(abi.encode(r));

	}

}
