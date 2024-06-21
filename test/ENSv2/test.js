import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {EVMProver, EVMRequest} from '../../src/vm2.js';

let foundry = await Foundry.launch();

let registryStorage = await foundry.deploy({file: 'RegistryStorage'});

// await foundry.confirm(storage.setNode(root, 'eth', root_eth.target, ethers.ZeroAddress));
// await foundry.confirm(storage.setNode(root_eth, 'nick', root_eth_nick.target, nick_resolver.target));
// await foundry.confirm(storage.setNode(root_eth, 'leaf', ethers.ZeroAddress, leaf_resolver.target));

// await foundry.confirm(nick_resolver.setText(ethers.namehash('foo.bar.nick.eth'), 'name', 'Foo'));
// await foundry.confirm(nick_resolver.setText(ethers.namehash('nick.eth'), 'name', 'Nick'));
// await foundry.confirm(leaf_resolver.setText(ethers.namehash('leaf.eth'), 'name', 'Leaf'));


async function deploy_registry() {
	return foundry.deploy({sol: `
		contract Registry {	
		}
	`});
}


let prover = await EVMProver.latest(foundry.provider);



