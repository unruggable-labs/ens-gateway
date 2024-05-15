import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {GatewayRequest, MultiExpander} from '../../src/MultiExpander.js';
import assert from 'node:assert/strict';

let foundry = await Foundry.launch();

let A = await foundry.deploy({sol: `
	import "@src/evm-verifier3/EVMFetcher.sol";
	contract A {
		using EVMFetcher for GatewayRequest;
		uint256 a = 0;
		uint256 b = 0;
		uint256 c = 1;
		function makeCall() external view returns (bytes memory) {
			GatewayRequest memory r = EVMFetcher.create();
			r.push(address(this));
			r.target();
			r.push(2);
			r.push(1);
			r.push(uint256(0));
			r.collect_first(0);
			return r.encode('');
		}
	}	
`});

let r = GatewayRequest.create();
r.push(A.target);
r.focus();
r.push(2);
r.push(1);
r.push(0);
r.collect_first(0);

assert.equal(await A.makeCall(), r.encode());

let expander = await MultiExpander.latest(foundry.provider);
let outputs = await MultiExpander.resolved(await expander.eval(r.ops, r.inputs));
console.log(outputs);

console.log(await expander.prove(outputs));

await foundry.shutdown();
