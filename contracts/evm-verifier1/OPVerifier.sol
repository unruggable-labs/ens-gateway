// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IEVMVerifier } from "./IEVMVerifier.sol";
import { StateProof, EVMProofHelper } from "./EVMProofHelper.sol";

import { RLPReader } from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
import {Hashing, Types} from "@eth-optimism/contracts-bedrock/src/libraries/Hashing.sol";

struct OPWitnessData {
    uint256 l2OutputIndex;
    Types.OutputRootProof outputRootProof;
}

interface IL2OutputOracle {
    function getL2Output(uint256 _l2OutputIndex) external view returns (Types.OutputProposal memory);
}

contract OPVerifier is IEVMVerifier {
    error OutputRootMismatch(uint256 l2OutputIndex, bytes32 expected, bytes32 actual);

    IL2OutputOracle public opOracle;
    string[] _gatewayURLs;

    constructor(string[] memory urls, address outputOracle) {
        _gatewayURLs = urls;
        opOracle = IL2OutputOracle(outputOracle);
    }

    function gatewayURLs() external view returns(string[] memory) {
        return _gatewayURLs;
    }

    function getStorageValues(address target, bytes32[] memory commands, bytes[] memory constants, bytes memory proof) external view returns(bytes[] memory values) {
        (OPWitnessData memory opData, StateProof memory stateProof) = abi.decode(proof, (OPWitnessData, StateProof));
        Types.OutputProposal memory l2out = opOracle.getL2Output(opData.l2OutputIndex);
        bytes32 expectedRoot = Hashing.hashOutputRootProof(opData.outputRootProof);
        if(l2out.outputRoot != expectedRoot) {
            revert OutputRootMismatch(opData.l2OutputIndex, expectedRoot, l2out.outputRoot);
        }
        return EVMProofHelper.getStorageValues(target, commands, constants, opData.outputRootProof.stateRoot, stateProof);
    }
}
