// https://github.com/scroll-tech/scroll/blob/738c85759d0248c005469972a49fc983b031ff1c/contracts/src/libraries/verifier/ZkTrieVerifier.sol#L259

// https://github.com/scroll-tech/go-ethereum/blob/staging/trie/zk_trie.go#L176
// https://github.com/scroll-tech/zktrie/blob/main/trie/zk_trie_proof.go#L30
// https://github.com/ethereum/go-ethereum/blob/master/trie/proof.go#L114
// https://github.com/scroll-tech/mpt-circuit/blob/v0.7/spec/mpt-proof.md#storage-segmenttypes
 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error InvalidProof();

import "forge-std/console2.sol";

library ZkTrieHelper {

	function proveAccountState(address hasher, bytes32 magic, bytes32 stateRoot, address account, bytes[] memory proof) internal view returns (bytes32 storageRoot, bytes32 codeHash) {
		checkProof(magic, proof);
		//bytes32 raw = bytes32(bytes20(account)); 
		bytes32 key = poseidonHash1(hasher, bytes32(bytes20(account))); // left aligned
		bytes32 leafHash = walkTree(hasher, key, proof, stateRoot);
		bytes memory leaf = proof[proof.length-2];
		if (uint8(leaf[0]) == 4) {
			checkLeaf(leaf, 230, bytes32(bytes20(account)), key, 0x05080000);
			// REUSING VARIABLE #1
			assembly { magic := mload(add(leaf, 69)) } // nonce||codesize||0
			// REUSING VARIABLE #2
			assembly { stateRoot := mload(add(leaf, 101)) } // balance
			assembly { storageRoot := mload(add(leaf, 133)) }
			assembly { codeHash := mload(add(leaf, 165)) }
			bytes32 h = poseidonHash2(hasher, storageRoot, poseidonHash1(hasher, codeHash), 1280);
			h = poseidonHash2(hasher, poseidonHash2(hasher, magic, bytes32(stateRoot), 1280), h, 1280);
			// REUSING VARIABLE #3
			assembly { magic := mload(add(leaf, 197)) }
			h = poseidonHash2(hasher, h, magic, 1280);
			h = poseidonHash2(hasher, key, h, 4);
			if (leafHash != h) revert InvalidProof(); // InvalidAccountLeafNodeHash
		} else if (uint8(leaf[0]) == 5) {
			if (leaf.length != 1) revert InvalidProof();
		} else {
			revert InvalidProof(); // InvalidAccountLeafNodeType
		}
	}

	function proveStorageValue(address hasher, bytes32 magic, bytes32 storageRoot, uint256 slot, bytes[] memory proof) internal view returns (bytes32 value) {
		checkProof(magic, proof);
		bytes32 key = poseidonHash1(hasher, bytes32(slot));
		bytes32 leafHash = walkTree(hasher, key, proof, storageRoot);
		bytes memory leaf = proof[proof.length-2];
		uint256 nodeType = uint8(leaf[0]);
		if (nodeType == 4) {
			checkLeaf(leaf, 102, bytes32(slot), key, 0x01010000);
			assembly { value := mload(add(leaf, 69)) }
			bytes32 h = poseidonHash2(hasher, key, poseidonHash1(hasher, value), 4);
			if (leafHash != h) revert InvalidProof(); // InvalidStorageLeafNodeHash
		} else if (nodeType == 5) {
			if (leaf.length != 1) revert InvalidProof();
			if (leafHash != 0) revert InvalidProof(); // InvalidStorageEmptyLeafNodeHash
			return 0;
		} else {
			revert InvalidProof(); // InvalidStorageLeafNodeType
		}
	}

	function checkLeaf(bytes memory leaf, uint256 len, bytes32 raw, bytes32 key, bytes4 flag) internal pure {
		if (leaf.length != len) revert InvalidProof();
		bytes32 temp;
		assembly { temp := mload(add(leaf, 33)) }
		if (temp != key) revert InvalidProof(); // KeyMismatch
		assembly { temp := mload(add(leaf, 65)) } 
		if (bytes4(temp) != flag) revert InvalidProof(); // InvalidCompressedFlag
		if (uint8(leaf[len - 33]) != 32) revert InvalidProof(); // InvalidKeyPreimageLength	
		assembly { temp := mload(add(leaf, len)) }
		if (temp != raw) revert InvalidProof(); // InvalidKeyPreimage
	}

	function checkProof(bytes32 magic, bytes[] memory m) internal pure {
		// root leaf data magic
		if (m.length < 4 || m.length >= 249) revert InvalidProof(); 
		// this seems wrong lol
		if (keccak256(m[m.length-1]) != magic) revert InvalidProof();
	}

	function walkTree(address hasher, bytes32 key, bytes[] memory proof, bytes32 rootHash) internal view returns (bytes32 expectedHash) {
		uint256 n = proof.length - 2;
		for (uint256 i = 0; i < n; ++i) {
			bytes memory v = proof[i];
			if (v.length != 65) revert InvalidProof();
			uint256 nodeType = uint8(v[0]);
			if (nodeType < 6 || nodeType > 9) revert InvalidProof(); // InvalidBranchNodeType
			bytes32 l;
			bytes32 r;
			assembly {
				l := mload(add(v, 33))
				r := mload(add(v, 65))
			}
			bytes32 h = poseidonHash2(hasher, l, r, nodeType);
			if (i == 0) {
				if (h != rootHash) revert InvalidProof();
			} else if (h != expectedHash) {
				revert InvalidProof(); // BranchHashMismatch
			}
			expectedHash = uint256(key) & 1 == 0 ? l : r;
			key >>= 1;
			console2.logBytes32(expectedHash);
		}
	}

	function poseidonHash1(address hasher, bytes32 x) internal view returns (bytes32) {
		return poseidonHash2(hasher, x >> 128, (x << 128) >> 128, 512);
	}
	function poseidonHash2(address hasher, bytes32 v0, bytes32 v1, uint256 domain) internal view returns (bytes32 r) {
		// interface IPoseidon {
		// 	function poseidon(uint256[2], uint256) external view returns (bytes32);
		// }
		// try POSEIDON.poseidon([uint256(v0), uint256(v1)], domain) returns (bytes32 h) {
		// 	return h;
		// } catch {
		// 	revert InvalidProof();
		// }
		bool success;
		assembly {
			let x := mload(0x40)
			// keccak256("poseidon(uint256[2],uint256)")
			mstore(x, 0xa717016c00000000000000000000000000000000000000000000000000000000)
			mstore(add(x, 0x04), v0)
			mstore(add(x, 0x24), v1)
			mstore(add(x, 0x44), domain)
			success := staticcall(gas(), hasher, x, 0x64, 0x20, 0x20)
			r := mload(0x20)
		}
		if (!success) revert InvalidProof();
	}

}
