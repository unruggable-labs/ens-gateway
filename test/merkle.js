import {ethers} from 'ethers';
import {create_provider, CHAIN_BASE} from '../src/providers.js';
import {proveAccountState} from '../src/merkle.js';

let provider = create_provider(CHAIN_BASE);

let AA = [
	'0x0f1449c980253b576aba379b11d453ac20832a89',
	'0x51050ec063d393217B436747617aD1C2285Aeeee',
	'0x51050ec063d393217B436747617aD1C2285Aeeef'.toLowerCase()
];

let block = await provider.getBlock();
let block_hex = ethers.toBeHex(block.number);

for (let A of AA) {

	let proof = await provider.send('eth_getProof', [A, [], block_hex]);

	console.log(A, proveAccountState(A, proof.accountProof, block.stateRoot));

}