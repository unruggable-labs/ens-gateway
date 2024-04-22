import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {Arb1Gateway} from '../../src/server2/Arb1Gateway.js';
import {provider_url, create_provider_pair, CHAIN_ARB1} from '../../src/providers.js';
import {ethers} from 'ethers';

let foundry = await Foundry.launch({fork: provider_url(1)});

let gateway = Arb1Gateway.mainnet(create_provider_pair(CHAIN_ARB1));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'evm-verifier2/Arb1Verifier', args: [[ccip.endpoint], gateway.L2Rollup]});

let fetcher = await foundry.deploy({file: 'Fetcher2', args: [verifier]});

const address = '0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d';

console.log('Supply', await fetcher.getBytes32(address, 7, {enableCcipRead: true}));

console.log('BaseURL', ethers.toUtf8String(await fetcher.getBytes(address, 8, {enableCcipRead: true})));

foundry.shutdown();
ccip.http.close();
