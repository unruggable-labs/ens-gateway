import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {create_provider, CHAIN_BASE, CHAIN_ARB1} from '../../src/providers.js';

let p = create_provider(CHAIN_BASE); // CHAIN_ARB1

let block = await p.getBlock();
let address = '0x0000000000000000000000000000000000000004';
//let address = '0x0f1449C980253b576aba379B11D453Ac20832a89';

let foundry = await Foundry.launch();

let verifier = await foundry.deploy({sol: `
	import {RLPReader} from "@eth-optimism/contracts-bedrock/src/libraries/rlp/RLPReader.sol";
	import {SecureMerkleTrie} from "@src/trie-with-nonexistance/SecureMerkleTrie.sol";
	contract V {
		function getStorageRoot(bytes32 stateRoot, address target, bytes[] memory witness) external pure returns (bytes32) {
			(, bytes memory accountData) = SecureMerkleTrie.get(abi.encodePacked(target), witness, stateRoot);
			RLPReader.RLPItem[] memory accountItems = RLPReader.readList(accountData);
			return bytes32(RLPReader.readBytes(accountItems[2]));
		}
	}
`});

let {accountProof} = await p.send('eth_getProof', [address, [ethers.toBeHex(0, 32)], '0x' + block.number.toString(16)]);
let res = await verifier.getStorageRoot(block.stateRoot, address, accountProof);

console.log(res);

foundry.shutdown();
