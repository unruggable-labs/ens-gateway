import {ethers} from 'ethers';
import {SingleSlotProver} from '../src/SingleSlotProver.js';

let provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, {staticNetwork: true});

//console.log(await ssp.lastOutput());
//console.log(await ssp.prove('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f', 0));

// for (let i = 0; i < 16; i++) {
// 	console.log(i, await ssp.provider2.getStorage('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f', i));
// }

const A = '0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f';

const SLOT_MAP = 0;



console.log(await ssp.provider2.getStorage(A, 0n));
