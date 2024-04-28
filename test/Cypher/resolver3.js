import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {Arb1Gateway} from '../../src/server3/Arb1Gateway.js';
import {provider_url, create_provider_pair, CHAIN_ARB1} from '../../src/providers.js';

let foundry = await Foundry.launch({fork: provider_url(1), procLog: true});

let gateway = Arb1Gateway.mainnet(create_provider_pair(CHAIN_ARB1));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'evm-verifier3/Arb1Verifier', args: [[ccip.endpoint], gateway.L2Rollup]});

let contract = await foundry.deploy({file: 'MultiTargetDemo', args: [verifier]});

console.log(await contract.cypher({enableCcipRead: true}));

foundry.shutdown();
ccip.http.close();
