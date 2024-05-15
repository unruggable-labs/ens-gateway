import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {GatewayRequest, MultiExpander} from '../../src/MultiExpander.js';

let foundry = await Foundry.launch();

let A = await foundry.deploy({sol: `
	contract A {
		mapping (uint256 => string) map;
		constructor() {
			map[69] = "nice chonk";
		}
	}
`});

let B = await foundry.deploy({sol: `
	contract B {
		uint256 a = 0;
		uint256 b = 0;
		bytes c = hex'${A.target.slice(2)}';
	}
`});


let r = GatewayRequest.create();
r.push(B.target);
r.target();
r.push(0); r.add(); r.collect(0); // a
r.push(1); r.add(); r.collect(0); // b
r.push(2); r.add(); r.collect(1); // c
r.push_output(2); r.push_output(1); r.push_output(0); r.push_str(''); r.first(); r.focus();
r.push(69);
r.follow();
let oi = r.collect(1);

let expander = await MultiExpander.latest(foundry.provider);
let outputs = await MultiExpander.resolved(await expander.eval(r.ops, r.inputs));
console.log(outputs);

console.log(ethers.toUtf8String(outputs[oi].value));

//console.log(await expander.prove(outputs));

await foundry.shutdown();
