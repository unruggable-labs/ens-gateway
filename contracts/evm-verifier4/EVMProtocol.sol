// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

uint256 constant MAX_STACK = 64;

uint8 constant OP_DEBUG = 255;
uint8 constant OP_TARGET = 1;
uint8 constant OP_SET_OUTPUT = 2;
uint8 constant OP_EVAL = 3;

uint8 constant OP_REQ_TARGET = 10;
uint8 constant OP_REQ_NONZERO = 11;

uint8 constant OP_READ_SLOTS = 20;
uint8 constant OP_READ_BYTES = 21;
uint8 constant OP_READ_ARRAY = 22;

uint8 constant OP_SLOT_ZERO		= 30;
uint8 constant OP_SLOT_ADD		= 31;
uint8 constant OP_SLOT_FOLLOW	= 32;

uint8 constant OP_PUSH_INPUT	= 40;
uint8 constant OP_PUSH_OUTPUT	= 41;
uint8 constant OP_PUSH_SLOT		= 42;
uint8 constant OP_PUSH_TARGET   = 43;

uint8 constant OP_DUP = 50;
uint8 constant OP_POP = 51;

uint8 constant OP_STACK_KECCAK	= 60;
uint8 constant OP_STACK_CONCAT	= 61;
uint8 constant OP_STACK_SLICE	= 62;

struct EVMRequest {
	bytes ops;
	bytes[] inputs;
}

struct ProofSequence {
	uint256 index;
	bytes32 stateRoot;
	bytes map;
	bytes[][] data;
}

// the limits are very high so RequestOverflow() is unlikely
// the typical fetch request is incredibly small relative to the proof
// so there's no need for data-saving operations (like PUSH_BYTE)
// currently, inputs are not embedded into the ops buffer
// but they could be to further simplify the protocol
error RequestOverflow();

// this should be unreachable with a valid EVMRequest
error RequestInvalid();
