import {Foundry, Resolver, Node} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {OPGateway} from '../../src/server2/OPGateway.js';
import {ethers} from 'ethers';
import {provider_url, create_provider_pair, CHAIN_BASE} from '../../src/providers.js';

let foundry = await Foundry.launch({fork: provider_url(1)});

let gateway = OPGateway.base_mainnet(create_provider_pair(CHAIN_BASE));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'evm-verifier2/OPVerifier', args: [[ccip.endpoint], gateway.L2OutputOracle, 0]});

let teamnick = await foundry.deploy({file: 'TeamNick2', args: [verifier]});

function get_resolver(name) {
	let r = new Resolver(Node.create(name), new ethers.Contract(teamnick, Resolver.ABI, foundry.provider));
	r.wild = true;
	return r;
}

async function dump(name) {
	let r = get_resolver(name);
	console.log(r.node.name, await r.profile([
		{type: 'text', arg: 'name'},
		{type: 'text', arg: 'avatar'},
		{type: 'addr', arg: 60},
		{type: 'addr'}
	]));
}

await dump('raffy.teamnick.eth');
await dump('slobo.teamnick.eth');

console.log(await get_resolver('teamnick.eth').profile([
	{type: 'addr', arg: 0x80000000n + 8453n},
	{type: 'text', arg: 'url'},
	{type: 'text', arg: 'description'}
]));


foundry.shutdown();
ccip.http.close();

// console.log(prover.call_cache.cached);
// console.log(prover.slot_cache.cached);
// console.log(prover.output_cache.cached);
