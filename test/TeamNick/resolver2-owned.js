import {Foundry, Resolver, Node} from '../../../blocksmith.js/src/index.js'; //@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {OPGateway} from '../../src/server2/OPGateway.js';
import {expand_slots} from '../../src/evm-storage.js';
import {ethers} from 'ethers';

let foundry = await Foundry.launch({fork: 'https://cloudflare-eth.com'});

let prover = OPGateway.forBaseMainnet({
	provider1: foundry.provider,
	expander: expand_slots
});

let ccip = await serve(prover, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'evm-verifier2/OwnedOPVerifier', args: [prover.L2OutputOracle, [], 0]});

await foundry.confirm(verifier.setGatewayConfig([ccip.endpoint], 1));

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
