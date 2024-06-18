// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {GatewayRequest} from "./GatewayRequest.sol";
import {IEVMVerifier} from "./IEVMVerifier.sol";
import {EVMProofHelper, StateProof} from "./EVMProofHelper.sol";

import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {Hashing, Types} from "@eth-optimism/contracts-bedrock/src/libraries/Hashing.sol";
import "@eth-optimism/contracts-bedrock/src/dispute/interfaces/IDisputeGameFactory.sol";

interface IOptimismPortal {
    function disputeGameFactory() external view returns (IDisputeGameFactory);
	function respectedGameType() external view returns (GameType);
}

error SuperchainNoRespectedGame();
error SuperchainInvalidGame(uint256 gameIndex);

contract SuperchainVerifier is IEVMVerifier {

	uint256 constant GAME_CHUNK = 10;

	string[] public _gatewayURLs;
	IOptimismPortal immutable _portal;
	uint256 _delay;

	constructor(string[] memory urls, IOptimismPortal portal, uint256 delay) {
		_gatewayURLs = urls;
		_portal = portal;
		_delay = delay;
	}

	function findLatestGame() internal view returns (uint256) {
		IDisputeGameFactory factory = _portal.disputeGameFactory();
		GameType rgt = _portal.respectedGameType();
		uint256 n = factory.gameCount();
		n = n > _delay ? n - _delay : 0;
		while (n > 0) {
			uint256 c = n > GAME_CHUNK ? GAME_CHUNK : n;
			IDisputeGameFactory.GameSearchResult[] memory gs = factory.findLatestGames(rgt, n - 1, c);
			n -= c;
			for (uint256 i; i < gs.length; i++) {
				(, , address gameProxy) = gs[i].metadata.unpack();
				if (IDisputeGame(gameProxy).status() != GameStatus.CHALLENGER_WINS) {
					//return (gs[i].index, gameProxy);
					return gs[i].index;
				}
			}
		}
		revert SuperchainNoRespectedGame();
	}

	function getStorageContext() external view returns(string[] memory urls, bytes memory context) {
		urls = _gatewayURLs;
		context = abi.encode(findLatestGame()); //oracle.latestOutputIndex() - delay
	}

	function getStorageValues(bytes memory context, GatewayRequest memory req, bytes memory proof) external view returns (bytes[] memory) {
		uint256 gameIndex = abi.decode(context, (uint256));
		(
			Types.OutputRootProof memory outputRootProof, 
			bytes[][] memory accountProofs,
			StateProof[] memory stateProofs
		) = abi.decode(proof, (Types.OutputRootProof, bytes[][], StateProof[]));

		GameType rgt = _portal.respectedGameType();
		(GameType gt, , IDisputeGame gameProxy) = _portal.disputeGameFactory().gameAtIndex(gameIndex);
		if (gt.raw() != rgt.raw() || gameProxy.status() == GameStatus.CHALLENGER_WINS) {
			revert SuperchainInvalidGame(gameIndex);
		}

		bytes32 outputRoot = gameProxy.rootClaim().raw();
		bytes32 expectedRoot = Hashing.hashOutputRootProof(outputRootProof);
		if (outputRoot != expectedRoot) {
			revert OutputRootMismatch(context, expectedRoot, outputRoot);
		}
		return EVMProofHelper.getStorageValues(req, outputRootProof.stateRoot, accountProofs, stateProofs);
	}

}
