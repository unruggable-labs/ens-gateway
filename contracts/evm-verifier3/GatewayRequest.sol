// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

struct GatewayRequest {
	uint256 outputs;
	bytes ops;
	bytes[] inputs;
}
