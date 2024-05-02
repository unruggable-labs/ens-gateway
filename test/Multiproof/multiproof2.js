import {Foundry} from '@adraffy/blocksmith';
import {MultiExpander, GatewayRequest} from '../src/MultiExpander.js';
import {ethers} from 'ethers';
import {writeFileSync} from 'node:fs';

let foundry = await Foundry.launch();

let contract = await foundry.deploy({sol: `
	contract X {
		bytes blob;
		function set(bytes memory v) external {
			blob = v;
		}
	}
`});
await foundry.confirm(contract.set(ethers.randomBytes(32 * 10)));

let r = GatewayRequest.create();
r.push(contract.target); 
r.focus();
r.collect(1);

let me = new MultiExpander(foundry.provider, foundry.provider.getBlock());

let outputs = await me.eval(r.ops, r.inputs);

let [accountProofs, stateProofs] = await me.prove(outputs);

console.log(stateProofs.map(x => x[1].length));

function decode(v) {
	return v.map(s => ethers.decodeRlp(s));
}

accountProofs = accountProofs.map(decode);
let storageProofs = stateProofs.map(x => decode(x[1][0]));


writeFileSync(new URL('./Multiproof2.json', import.meta.url), JSON.stringify({
	accountProofs,
	storageProofs
}));


