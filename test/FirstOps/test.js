import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {OPGateway} from '../../src/server3/OPGateway.js';
import {provider_url, create_provider_pair, CHAIN_BASE} from '../../src/providers.js';

let foundry = await Foundry.launch({fork: provider_url(1), procLog: true});

let gateway = OPGateway.base_mainnet(create_provider_pair(CHAIN_BASE));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'evm-verifier3/OPVerifier', args: [[ccip.endpoint], gateway.L2OutputOracle, 0]});

let resolver = await foundry.deploy({file: 'FirstOps', args: [verifier]});

// https://basescan.org/address/0x0f1449c980253b576aba379b11d453ac20832a89#code
const TEAMNICK_POINTER = '0x0f1449C980253b576aba379B11D453Ac20832a89';

// collect.js
// console.log(await resolver.collect_first(TEAMNICK_POINTER, [2, 1, 0], 0, {enableCcipRead: true}));

// // stack.js
// console.log(await resolver.stack_first({enableCcipRead: true}));

// target.js
console.log(await resolver.target_first([
	TEAMNICK_POINTER, 
	'0x51050ec063d393217B436747617aD1C2285Aeeee', 
	ethers.toBeHex(1, 20)
], 0, 0, {enableCcipRead: true}));



foundry.shutdown();
ccip.http.close();

