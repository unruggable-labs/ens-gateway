// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

struct GatewayRequest {
	uint256 outputs;
	bytes ops;
	bytes[] inputs;
}
