import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {OPGateway} from '../src/server3/OPGateway.js';
import {provider_url, create_provider_pair, CHAIN_BASE} from '../src/providers.js';
import {inspect} from 'node:util';

let debug = false;
let foundry = await Foundry.launch({fork: provider_url(1), procLog: debug});
if (debug) foundry.provider.on('debug', e => console.log(inspect(e, false, Infinity)));

let gateway = OPGateway.base_mainnet(create_provider_pair(CHAIN_BASE));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'evm-verifier3/OPVerifier', args: [[ccip.endpoint], gateway.L2OutputOracle, 0]});

let contract = await foundry.deploy({file: 'MultiTargetDemo', args: [verifier]});

console.log(await contract.teamnick({enableCcipRead: true}));

foundry.shutdown();
ccip.http.close();
