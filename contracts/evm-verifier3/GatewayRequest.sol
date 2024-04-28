// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

uint256 constant MAX_OPS = 256;

uint8 constant MAX_INPUTS = 255;
uint8 constant MAX_OUTPUTS = 255;

uint8 constant OP_PATH_START	= 1;
uint8 constant OP_PATH_END		= 2;
uint8 constant OP_PUSH			= 10;
uint8 constant OP_PUSH_OUTPUT	= 11;
//uint8 constant OP_PUSH_BYTE		= 12;
uint8 constant OP_SLOT_ADD		= 20;
uint8 constant OP_SLOT_FOLLOW	= 21;
uint8 constant OP_STACK_KECCAK	= 30;
uint8 constant OP_STACK_CONCAT  = 31;
uint8 constant OP_STACK_SLICE	= 32;

struct GatewayRequest {
	bytes ops;
	bytes[] inputs;
}

interface GatewayAPI {
	function fetch(bytes memory context, GatewayRequest memory req) external pure returns (bytes memory witness);
}

error AccountNotFound(address);
