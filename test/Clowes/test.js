import {Foundry} from '@adraffy/blocksmith';
import {GatewayRequest, MultiExpander} from '../../src/MultiExpander.js';
import assert from 'node:assert/strict';

let foundry = await Foundry.launch();

let storage = await foundry.deploy({file: 'SlotDataContract', args: [foundry.wallets.admin]});

// uint256 latest = 49;                                // Slot 0
// string name;                                        // Slot 1
// mapping(uint256=>uint256) highscores;               // Slot 2
// mapping(uint256=>string) highscorers;               // Slot 3
// mapping(string=>string) realnames;                  // Slot 4
// uint256 zero;                                       // Slot 5
// bytes pointlessBytes;                               // Slot 6
// bytes paddedAddress;                                // Slot 7
// mapping(address=>string) addressIdentifiers;        // Slot 8
// string iam = "tomiscool";                           // Slot 9
// mapping(string=>string) stringStrings;              // Slot 10
// address anotherAddress;                             // Slot 11

let storage_pointer = await foundry.deploy({sol: `
	contract Pointer {
		address a;
		constructor(address _a) {
			a = _a;
		}
	}
`, args: [storage]});

let builder = await foundry.deploy({sol: `
	import "@src/evm-verifier3/EVMFetcher.sol";
	contract Builder {
		using EVMFetcher for GatewayRequest;
		function makeCall(address a) external pure returns (bytes memory) {
			GatewayRequest memory r = EVMFetcher.create();
			r.push(a); r.focus(); 
			r.collect(0);
			r.output(0); r.focus();
			r.push(uint256(0)); r.add(); r.collect(0);	// uint256
			r.push(1); r.add(); r.collect(1);	// string name
			r.push(2); r.add(); r.push(1);		// highscores[1]
			r.push(2); r.add(); r.output(1);	// highscores[latest]
			return r.encode('');
		}
	}
`});

let call0 = await builder.makeCall(storage_pointer);

let r0 = GatewayRequest.decode(call0);

assert.equal(call0, r0.encode());

let r1 = GatewayRequest.create();
r1.push(storage_pointer.target); r1.focus();
r1.collect(0);
r1.output(0); r1.focus();
r1.push(0); r1.add(); r1.collect(0);
r1.push(1); r1.add(); r1.collect(1);
r1.push(2); r1.add(); r1.push(1);
r1.push(2); r1.add(); r1.output(1);

assert.equal(call0, r1.encode());

let me = await MultiExpander.latest(foundry.provider);

let outputs = await MultiExpander.resolved(await me.eval(r0.ops, r0.inputs));

console.log(outputs);

foundry.shutdown();


