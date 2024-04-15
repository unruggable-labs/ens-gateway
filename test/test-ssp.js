import {Foundry} from '@adraffy/blocksmith';
import {serve, SingleSlotProver} from '../server/src/SingleSlotProver.js';

let foundry = await Foundry.launch({
	fork: 'https://cloudflare-eth.com', 
});

let ssp = SingleSlotProver.forBaseMainnet({
	provider1: foundry.provider,
});

let ccip = await serve(ssp.ezccip, {protocol: 'raw'});

let demo = await foundry.deploy({file: 'SingleSlotDemo', args: [[ccip.endpoint], ssp.L2OutputOracle]});

console.log(await demo.prove('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f', 8n, {enableCcipRead: true}));

