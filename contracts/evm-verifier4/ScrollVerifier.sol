// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

//import "./ProofUtils.sol";
import {EVMRequest} from "./EVMProtocol.sol";
import {IEVMVerifier} from "./IEVMVerifier.sol";
import {EVMProver, ProofSequence} from "./EVMProver.sol";
import {ZkTrieHelper} from "./ZkTrieHelper.sol";

interface IScrollChain {
	function lastFinalizedBatchIndex() external view returns (uint256);
	function finalizedStateRoots(uint256 batchIndex) external view returns (bytes32);
}

interface IScrollChainCommitmentVerifier {
	function rollup() external view returns (IScrollChain);
	function poseidon() external view returns (address);
}

contract ScrollVerifier is IEVMVerifier {

	// https://github.com/scroll-tech/zktrie/blob/23181f209e94137f74337b150179aeb80c72e7c8/trie/zk_trie_proof.go#L13
	//bytes32 constant MAGIC = keccak256("THIS IS SOME MAGIC BYTES FOR SMT m1rRXgP2xpDI");
	uint256 constant INDEX_STEP = 16;

	IScrollChainCommitmentVerifier immutable _oracle;
	string[] public _urls;
	uint128 public _delay;
	uint128 public _step;

	constructor(string[] memory urls, IScrollChainCommitmentVerifier oracle, uint128 delay, uint128 step) {
		_urls = urls;
		_oracle = oracle;
		_delay = delay;
		_step = step;
	}

	function getStorageContext() external view returns(string[] memory urls, bytes memory context) {
		urls = _urls;
		uint256 index = _oracle.rollup().lastFinalizedBatchIndex() - _delay;
		index -= (index % _step);
		context = abi.encode(index);
	}

	function getStorageValues(bytes memory context, EVMRequest memory req, bytes memory proof) external view returns (bytes[] memory, uint8 exitCode) {
		uint256 index = abi.decode(context, (uint256));
		(bytes[][] memory proofs, bytes memory order) = abi.decode(proof, (bytes[][], bytes));
		bytes32 stateRoot = _oracle.rollup().finalizedStateRoots(index);
		return EVMProver.evalRequest(req, ProofSequence(0, stateRoot, proofs, order, proveAccountState, proveStorageValue));
	}

	function proveStorageValue(bytes32 storageRoot, uint256 slot, bytes[] memory proof) internal view returns (uint256) {
		return uint256(ZkTrieHelper.proveStorageValue(_oracle.poseidon(), storageRoot, slot, proof));
	}

	function proveAccountState(bytes32 stateRoot, address target, bytes[] memory proof) internal view returns (bytes32) {
		return ZkTrieHelper.proveAccountState(_oracle.poseidon(), stateRoot, target, proof);
	}

}
