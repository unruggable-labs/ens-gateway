import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {EVMProver, EVMRequest} from '../../src/vm2.js';

let foundry = await Foundry.launch({procLog: false});

function dns(name) {
	return ethers.dnsEncode(name, 255);
}

async function deploy_resolver() {
	// foundry.deploy({import: '@ensdomains/ens-contracts/contracts/resolvers/OwnedResolver.sol'});
	return foundry.deploy({sol: `
		contract Resolver {
			mapping (bytes32 => mapping(string => string)) _texts;
			function setText(bytes32 node, string memory key, string memory value) external {
				_texts[node][key] = value;
			}
		}
	`});
}

let wallet_admin = foundry.requireWallet('admin');
let wallet_raffy = await foundry.createWallet('raffy');

let resolver_eth = await deploy_resolver();
let resolver_raffy = await deploy_resolver();

let storage = await foundry.deploy({file: 'RegistryStorage'});

async function create_registry(parent) {
	return foundry.deploy({file: 'V2Registry', args: [storage, parent]});
}
let registry_root = await create_registry(ethers.ZeroAddress);
let registry_eth  = await create_registry(registry_root);

await foundry.confirm(storage.setRegistry(ethers.ZeroAddress, ethers.ZeroHash, registry_root))
await foundry.confirm(registry_root.setSubnode(wallet_admin, dns('eth'), resolver_eth, registry_eth, wallet_admin));
await foundry.confirm(registry_eth.setSubnode(wallet_raffy, dns('raffy.eth'), resolver_raffy, ethers.ZeroAddress, wallet_raffy));

await foundry.confirm(resolver_eth.setText(ethers.namehash('chonk.eth'), 'name', 'Chonk'));
await foundry.confirm(resolver_raffy.setText(ethers.namehash('raffy.eth'), 'name', 'Raffy'));
await foundry.confirm(resolver_raffy.setText(ethers.namehash('sub.raffy.eth'), 'name', 'Subdomain!'));


let prover = await EVMProver.latest(foundry.provider);
prover.log = console.log;

async function resolve(name) {
	let req = new EVMRequest(3);
	req.push(storage.target).target(); // use storage contract
	req.push(0).setOutput(0); // start at root (not actually needed)
	name.split('.').forEach((_, i, v) => req.push(ethers.namehash(v.slice(i).join('.'))));
	req.push(0); // add namehash for root
	req.offset(0) // _nodes mapping
	req.begin()
		.pushOutput(0) // registry (as uint256)
		.follow().follow() // map[registry][node]
		.read() // resolver
		.begin()
			.requireNonzero().setOutput(1) // save nonzero resolver
		.end().eval({back: 1})
		.offset(1).read() // registry
		.requireNonzero() // require registry
		.setOutput(0) // save it
	.end().eval({failure: true}) // loop until we get a failure
	req.pushOutput(1).requireNonzero().target() // set target to resolver
		.offset(0) // _texts mapping
		.push(ethers.namehash(name)).follow().pushStr('name').follow() // _texts[node][key]
		.readBytes().setOutput(2); // read text(name) store into output	

	let result = await prover.evalRequest(req);
	console.log();
	console.log({name});
	console.log(result);
	let values = await result.values();
	console.log({
		registry: ethers.AbiCoder.defaultAbiCoder().decode(['address'], values[0])[0],
	});
	if (result.exitCode) {
		console.log(`<doesn't exist>`);
	} else {
		console.log(values);
		console.log({
			resolver: ethers.AbiCoder.defaultAbiCoder().decode(['address'], values[1])[0],
			text: ethers.toUtf8String(values[2])
		});
	}
}

await resolve('raffy.eth'); // raffy resolver
await resolve('sub.raffy.eth'); // raffy resolver (-1)
await resolve('chonk.eth'); // eth resolver
await resolve('does-not-exist'); // no resolver

foundry.shutdown();
