import {Foundry, Resolver, Node} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {Arb1Gateway} from '../../src/server2/Arb1Gateway.js';
import {deploy_ens} from '../ens.js';
import {provider_url, create_provider_pair, CHAIN_ARB1} from '../../src/providers.js';

let foundry = await Foundry.launch({fork: provider_url(1)});

let prover = Arb1Gateway.mainnet(create_provider_pair(CHAIN_ARB1));

let ccip = await serve(prover, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'evm-verifier2/Arb1Verifier', args: [[ccip.endpoint], prover.L2Rollup]});

let ens = await deploy_ens(foundry);
let root = Node.root();

const CYPHER_NFT = '0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d';

let cypher_resolver = await foundry.deploy({file: 'XCTENS2', args: [ens, verifier, CYPHER_NFT, CHAIN_ARB1]});

let basename = await ens.$register(root.create('cypher'), {resolver: cypher_resolver});

let owned_resolver = await foundry.deploy({file: 'OwnedResolver'});
let _basename = await ens.$register(basename.create('_'), {resolver: owned_resolver});
await foundry.confirm(owned_resolver.setText(_basename.namehash, 'url', 'https://www.cu-cypherpunk.com/'));

console.log(await Resolver.get(ens, basename).then(r => r.profile([
	{type: 'text', arg: 'url'},
	{type: 'text', arg: 'description'},	
	{type: 'addr', arg: 0x80000000 + CHAIN_ARB1}
])));

console.log(await Resolver.get(ens, basename.create('slobo')).then(r => r.profile([
	{type: 'text', arg: 'owner'},
	{type: 'text', arg: 'com.twitter'},
	{type: 'text', arg: 'avatar'},
	{type: 'addr', arg: 60},
	{type: 'addr'},
	{type: 'addr', arg: 0x80000000 + CHAIN_ARB1}
])));

foundry.shutdown();
ccip.http.close();
