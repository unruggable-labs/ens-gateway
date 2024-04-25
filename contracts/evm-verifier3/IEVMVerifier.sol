//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {GatewayRequest} from "./EVMFetcher.sol";

interface IEVMVerifier {
	
	function getStorageContext() external view returns(string[] memory urls, bytes memory context);
	
	function getStorageValues(
		bytes memory context,
		GatewayRequest memory fetch,
		bytes memory proof
	) external view returns(bytes[] memory values);

}

