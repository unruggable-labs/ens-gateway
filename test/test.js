import {Foundry} from '@adraffy/blocksmith';
import {serve, SingleSlotProver} from '../server/src/SingleSlotProver.js';
import {ethers} from 'ethers';

let foundry = await Foundry.launch({fork: 'https://cloudflare-eth.com'});

let ssp = SingleSlotProver.forBaseMainnet({
	provider1: foundry.provider,
});

let ccip = await serve(ssp.ezccip);

let provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, {staticNetwork: true});



let ccip = await serve(create_prover({provider}))