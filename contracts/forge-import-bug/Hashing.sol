// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//import { Hashing } from "@eth-optimism/contracts-bedrock/src/libraries/Hashing.sol";

import { Types } from "@eth-optimism/contracts-bedrock/src/libraries/Types.sol";

/// @title Hashing
/// @notice Hashing handles Optimism's various different hashing schemes.
library Hashing {
  
    /// @notice Hashes the various elements of an output root proof into an output root hash which
    ///         can be used to check if the proof is valid.
    /// @param _outputRootProof Output root proof which should hash to an output root.
    /// @return Hashed output root proof.
    function hashOutputRootProof(Types.OutputRootProof memory _outputRootProof) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _outputRootProof.version,
                _outputRootProof.stateRoot,
                _outputRootProof.messagePasserStorageRoot,
                _outputRootProof.latestBlockhash
            )
        );
    }
}
