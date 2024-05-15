import {ethers} from 'ethers';

let p = new ethers.CloudflareProvider();

console.log(await p.send('eth_getProof', ['0x51050ec063d393217B436747617aD1C2285Aeeee', [], 'latest']));