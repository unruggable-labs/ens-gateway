import {Foundry, Resolver, Node} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {OPGateway} from '../../src/server2/OPGateway.js';
import {ethers} from 'ethers';
import {provider_url, create_provider_pair, CHAIN_BASE} from '../../src/providers.js';

let foundry = await Foundry.launch({fork: provider_url(1)});

let gateway = OPGateway.base_mainnet(create_provider_pair(CHAIN_BASE));

let ccip = await serve(gateway, {protocol: 'raw'});

let root = Node.root();
let ens = await foundry.deploy({import: '@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol'});
Object.assign(ens, {
	async $register(node, {owner, resolver} = {}) {
		let w = foundry.requireWallet(await this.owner(node.parent.namehash));
		owner = foundry.requireWallet(owner, w);
		await foundry.confirm(this.connect(w).setSubnodeRecord(node.parent.namehash, node.labelhash, owner, resolver ?? ethers.ZeroAddress, 0), {name: node.name});
		return node;
	}
});

let verifier = await foundry.deploy({file: 'evm-verifier2/OwnedOPVerifier', args: [gateway.L2OutputOracle, [], 0]});

await foundry.confirm(verifier.setGatewayConfig([ccip.endpoint], 1));

let resolver = await foundry.deploy({file: 'TeamNick2Baseless', args: [ens, verifier]});

let eth = await ens.$register(root.create('eth'));
let basename = await ens.$register(eth.create('teamchonk'), {resolver});

function get_resolver(node) {
	let r = new Resolver(node, new ethers.Contract(resolver, Resolver.ABI, foundry.provider));
	r.wild = true;
	return r;
}

async function dump(node) {
	console.log(node.name, await get_resolver(node).profile([
		{type: 'text', arg: 'name'},
		{type: 'text', arg: 'avatar'},
		{type: 'addr', arg: 60},
		{type: 'addr'}
	]));
}

await dump(basename.create('raffy'));
await dump(basename.create('slobo'));

console.log(await get_resolver(basename).profile([
	{type: 'addr', arg: 0x80000000n + 8453n},
	{type: 'text', arg: 'url'},
	{type: 'text', arg: 'description'}
]));

foundry.shutdown();
ccip.http.close();
