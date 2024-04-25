//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {GatewayRequest} from "./GatewayRequest.sol";
import {IEVMVerifier} from "./IEVMVerifier.sol";
import {EVMFetcher} from "./EVMFetcher.sol";
import {OffchainNext} from "@resolverworks/OffchainNext-contracts/src/OffchainNext.sol";

abstract contract EVMFetchTarget is OffchainNext {

	struct Session {
		IEVMVerifier verifier;
		bytes context;
		GatewayRequest req;
		bytes4 callback;
		bytes carry;
	}

	function fetch(IEVMVerifier verifier, GatewayRequest memory req, bytes4 callback, bytes memory carry) internal view {
		(string[] memory urls, bytes memory context) = verifier.getStorageContext();
		offchainLookup(
			address(this),
			urls,
			EVMFetcher.encode(req, context),
			this.fetchCallback.selector,
			abi.encode(Session(verifier, context, req, callback, carry))
		);
	}

	function fetchCallback(bytes calldata response, bytes calldata carry) external view {
		Session memory ses = abi.decode(carry, (Session));
		bytes[] memory values = ses.verifier.getStorageValues(ses.context, ses.req, response);
		//if (values.length != expected) revert OffchainTryNext();
		(bool ok, bytes memory ret) = address(this).staticcall(abi.encodeWithSelector(ses.callback, values, ses.carry));
		if (!ok) revert OffchainTryNext();
		assembly { return(add(ret, 32), mload(ret)) }
	}

}
