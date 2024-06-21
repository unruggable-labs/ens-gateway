import {create_provider, CHAIN_SCROLL} from '../../src/providers.js';

let provider2 = create_provider(CHAIN_SCROLL);

//let proof = await provider2.send('eth_getProof', ['0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4', ['0x01', '0x02'], 'latest']);
let proof =   await provider2.send('eth_getProof', ['0xff01000000000000000000000000000000001a0f', ['0xFF'], 'latest']);


console.log(proof.accountProof);
console.log(proof.storageProof[0]);
