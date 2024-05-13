import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {GatewayRequest, MultiExpander} from '../../src/MultiExpander.js';

let foundry = await Foundry.launch();

let A = await foundry.deploy({sol: `
	contract A {
		uint256 a = 0;
		uint256 b = 0;
		uint256 c = 1;
	}
`});


let r = GatewayRequest.create();
r.push(A.target);
r.focus();
r.push(2);
r.push(1);
r.push(0);
r.collect_first(0);

console.log(r);
console.log(r.encode());

let expander = await MultiExpander.latest(foundry.provider);
let outputs = await MultiExpander.resolved(await expander.eval(r.ops, r.inputs));
console.log(outputs);

console.log(await expander.prove(outputs));

await foundry.shutdown();
