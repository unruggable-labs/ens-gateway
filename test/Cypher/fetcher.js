import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {Arb1Gateway} from '../../src/server2/Arb1Gateway.js';
import {expand_slots} from '../../src/evm-storage.js';
import {ethers} from 'ethers';

let foundry = await Foundry.launch({fork: 'https://cloudflare-eth.com'});

let prover = Arb1Gateway.mainnet({
	expander: expand_slots
});

let ccip = await serve(prover, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'evm-verifier2/Arb1Verifier', args: [[ccip.endpoint], prover.L2Rollup]});

let fetcher = await foundry.deploy({file: 'Fetcher2', args: [verifier]});

const address = '0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d';

// supply
console.log(await fetcher.getBytes32(address, 7, {enableCcipRead: true}));

// baseURL
console.log(ethers.toUtf8String(await fetcher.getBytes(address, 8, {enableCcipRead: true})));

foundry.shutdown();
ccip.http.close();
