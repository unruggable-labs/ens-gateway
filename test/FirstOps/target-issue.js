import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {create_provider, CHAIN_BASE, CHAIN_ARB1} from '../../src/providers.js';

let p = create_provider(CHAIN_BASE); // CHAIN_ARB1

let block = await p.getBlock();
let address = '0x0000000000000000000000000000000000000004';

let foundry = await Foundry.launch();

let decoder = await foundry.deploy({sol: `
	import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
	contract Decoder {	
		function decode(bytes memory v) external pure returns (RLPReader.RLPItem[] memory items, bytes32 storageRoot) {
			items = RLPReader.readList(v);
			storageRoot = bytes32(RLPReader.readBytes(items[2]));
		}
	}
`});

let verifier1 = await foundry.deploy({sol: `
	import {SecureMerkleTrie} from "@src/trie-with-nonexistance/SecureMerkleTrie.sol";
	contract V1 {
		function getStorageRoot(bytes32 stateRoot, address target, bytes[] memory witness) external pure returns (bool exists, bytes memory v) {
			(exists, v) = SecureMerkleTrie.get(abi.encodePacked(target), witness, stateRoot);
		}
	}
`});

let verifier0 = await foundry.deploy({sol: `
	import {SecureMerkleTrie} from "@eth-optimism/contracts-bedrock/src/libraries/trie/SecureMerkleTrie.sol";
	contract V0 {
		function getStorageRoot(bytes32 stateRoot, address target, bytes[] memory witness) external pure returns (bytes memory v) {
			v = SecureMerkleTrie.get(abi.encodePacked(target), witness, stateRoot);
		}
	}
`});

let {accountProof} = await p.send('eth_getProof', [address, [ethers.toBeHex(0, 32)], '0x' + block.number.toString(16)]);
let [_, res1] = await verifier1.getStorageRoot(block.stateRoot, address, accountProof);
let res0 = await verifier0.getStorageRoot(block.stateRoot, address, accountProof);

console.log({res0, res1, same: res0 === res1});

// https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/#state-trie
// [nonce, balance, storageRoot, codeHash]
console.log(await decoder.decode(res0));

// Result(2) [
// 	Result(4) [
// 	  Result(2) [ 1n, 162n ],
// 	  Result(2) [ 1n, 163n ],
// 	  Result(2) [ 33n, 164n ], <=== storageRoot
// 	  Result(2) [ 33n, 197n ]
// 	],
// 	'0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421' <=== null trie root
// ]

foundry.shutdown();

