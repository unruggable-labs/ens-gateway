import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {Arb1Gateway} from '../src/server3/Arb1Gateway.js';
import {RogueGateway} from '../src/server3/RogueGateway.js';
import {provider_url, create_provider_pair, CHAIN_ARB1} from '../src/providers.js';

let debug = false;
let foundry = await Foundry.launch({fork: provider_url(1), procLog: debug});
if (debug) foundry.provider.on('debug', e => console.log(e));

let gateway = Arb1Gateway.mainnet(create_provider_pair(CHAIN_ARB1));

let ccip = await serve(gateway, {protocol: 'raw'});
let ccip_rogue = await serve(RogueGateway.random_response(), {protocol: 'raw'});

let urls = [
	//"https://ethereum.org", 
	ccip_rogue.endpoint, 
	ccip.endpoint
];

let verifier = await foundry.deploy({file: 'evm-verifier3/Arb1Verifier', args: [urls, gateway.L2Rollup]});

let contract = await foundry.deploy({file: 'MultiTargetDemo', args: [verifier]});

console.log(await contract.cypher({enableCcipRead: true}));

foundry.shutdown();
ccip.http.close();
ccip_rogue.http.close();
