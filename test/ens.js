//import {Node} from '@adraffy/blocksmith';
import {ethers} from 'ethers';

export async function deploy_ens(foundry) {
	let ens = await foundry.deploy({import: '@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol'});
	Object.assign(ens, {
		async $register(node, {owner, resolver} = {}) {
			let w = foundry.requireWallet(await this.owner(node.parent.namehash));
			owner = foundry.requireWallet(owner, w);
			await foundry.confirm(this.connect(w).setSubnodeRecord(node.parent.namehash, node.labelhash, owner, resolver ?? ethers.ZeroAddress, 0), {name: node.name});
			return node;
		}
	});
	// let root = Node.root();
	// let eth = await ens.$register(root.create('eth'));
	// return {ens, root, eth};
	return ens;
}
