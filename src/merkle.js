
import {ethers} from 'ethers';

const BRANCH_NODE_SIZE = 17;
const LEAF_NODE_SIZE = 2;
const RLP_NULL = '0x80';

export const NULL_TRIE_HASH = ethers.keccak256(RLP_NULL);

export function proveAccountState(target, accountProof, stateRoot) {
	let rlp = proveMerkleTrieValue(target, accountProof, stateRoot, true);
	if (!rlp) return;
	let decoded = assertRlpVector(rlp);
	if (decoded.length != 4) throw new Error('invalid account state');
	let [nonce, balance, storageRoot, codeHash] = decoded;
	return {nonce, balance, storageRoot, codeHash};
}
export function proveStorageValue(slot, storageProof, storageRoot) {
	let rlp = proveMerkleTrieValue(ethers.toBeHex(slot, 32), storageProof, storageRoot, true);
	if (!rlp) return ethers.ZeroHash;
	let decoded = ethers.decodeRlp(rlp);
	if (typeof decoded !== 'string') throw new Error('invalid storage value');
	return ethers.zeroPadValue(decoded, 32);
}

// same arg order as MerkleTrie.get()
export function proveMerkleTrieValue(key, proof, root, secure) {
	try {
		let nodes = proof.map(rlp => {
			let decoded = assertRlpVector(rlp);
			switch (decoded.length) {
				case BRANCH_NODE_SIZE:
				case LEAF_NODE_SIZE: return {rlp, decoded};
				default: throw new Error('node size');
			}
		});
		let {pathLength, keyRemainder, final} = walk(nodes, secure ? ethers.keccak256(key) : key, root);
		if (keyRemainder.length) {
			if (!final) new Error('key remainder');
			return '';
		}
		let {decoded} = nodes[pathLength-1];
		return decoded[decoded.length-1];
	} catch (cause) {
		throw Object.assign(new Error('invalid proof', {cause}), {key, proof, root, secure});
	}
}

// this mirrors MerkleTrie.sol
function walk(nodes, key, root) {
	let keyNibbles = toNibbles(key);
	let nodeID = root;
	let keyIndex = 0;
	let keyDelta = 0;
	let pathLength = 0;
	outer: for (let node of nodes) {
		keyIndex += keyDelta;
		pathLength++;
		if (keyIndex == 0) {
			if (ethers.keccak256(node.rlp) != nodeID) throw new Error('invalid root hash');
		} else if (node.rlp.length >= 66) {
			if (ethers.keccak256(node.rlp) != nodeID) throw new Error('invalid branch hash');
		} else {
			if (node.rlp != nodeID) throw new Error('invalid leaf hash');
		}
		if (node.decoded.length == BRANCH_NODE_SIZE) {
			if (keyIndex == keyNibbles.length) break;
			nodeID = node.decoded[keyNibbles[keyIndex]];
			keyDelta = 1;
		} else {
			let pathNibbles = toNibbles(node.decoded[0]);
			let pathRemainder = pathNibbles.subarray(pathNibbles[0] & 1 ? 1 : 2);
			let keyRemainder = keyNibbles.subarray(keyIndex);
			let shared = getSharedNibbleLength(pathRemainder, keyRemainder);
			if (keyRemainder.length < pathRemainder.length) throw new Error('invalid key length');
			switch (pathNibbles[0]) {
				case 0: // PREFIX_EXTENSION_EVEN
				case 1: { // PREFIX_EXTENSION_ODD
					if (pathRemainder.length != keyRemainder.length) {
						nodeID = RLP_NULL;
						break outer;
					} else {
						nodeID = node.decoded[1];
						keyDelta = shared;
						continue;
					}
				}
				case 2: // PREFIX_LEAF_EVEN
				case 3: { // PREFIX_LEAF_ODD
					if (pathRemainder.length == shared && keyRemainder.length == shared) {
						keyIndex += shared;
					}
					nodeID = RLP_NULL;
					break outer;
				}
				default: throw new Error('invalid node prefix');
			}
		}
	}
	return {
		pathLength,
		keyRemainder: keyNibbles.slice(keyIndex),
		final: nodeID == RLP_NULL
	};
}

function assertRlpVector(rlp) {
	let v = ethers.decodeRlp(rlp);
	if (!Array.isArray(v) || !v.every(x => typeof x === 'string')) throw new Error('expected rlp vector');
	return v;
}
function toNibbles(s) {
	return Uint8Array.from(s.slice(2), x => parseInt(x, 16));
}
function getSharedNibbleLength(a, b) {
	let n = Math.min(a.length, b.length);
	let i = 0;
	while (i < n && a[i] == b[i]) i++;
	return i;
}
