import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {GatewayRequest, MultiExpander} from '../../src/MultiExpander.js';

let foundry = await Foundry.launch();

let A = await foundry.deploy({sol: `
	contract A {
		uint256 slot0;
		uint256 slot1 = 1;
	}
`});

let r = GatewayRequest.create();
r.push(A.target);
r.push(foundry.wallets.admin.address);
r.push(ethers.toBeHex(0, 32));
r.target_first();
r.push(1);
r.add();
r.collect(0);

let expander = await MultiExpander.latest(foundry.provider);
let outputs = await MultiExpander.resolved(await expander.eval(r.ops, r.inputs));
console.log(outputs);

console.log(await expander.prove(outputs));

await foundry.shutdown();
