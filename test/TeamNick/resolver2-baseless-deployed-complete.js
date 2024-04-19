import {Resolver, Node} from '@adraffy/blocksmith';
import {ethers} from 'ethers';

let provider = new ethers.CloudflareProvider();

let ens = new ethers.Contract('0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', [
	'function resolver(bytes32 node) view returns (address)',
], provider);

let basename = Node.create('chainbound.eth');

async function dump(node) {
	console.log(node.name, await (await Resolver.get(ens, node)).profile([
		{type: 'text', arg: 'name'},
		{type: 'text', arg: 'avatar'},
		{type: 'addr', arg: 60},
		{type: 'addr'}
	]));
}

await dump(basename.create('raffy'));
await dump(basename.create('slobo'));

console.log(await (await Resolver.get(ens, basename)).profile([
	{type: 'addr', arg: 0x80000000n + 8453n},
	{type: 'text', arg: 'url'},
	{type: 'text', arg: 'description'}
]));

provider.destroy();
