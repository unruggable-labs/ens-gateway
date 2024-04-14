import {ethers} from 'ethers';
import {SingleSlotProver} from '../src/SingleSlotProver.js';

let ssp = SingleSlotProver.forBaseMainnet({
	provider1: new ethers.CloudflareProvider()
});

//console.log(await ssp.lastOutput());
//console.log(await ssp.prove('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f', 0));

// for (let i = 0; i < 16; i++) {
// 	console.log(i, await ssp.provider2.getStorage('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f', i));
// }