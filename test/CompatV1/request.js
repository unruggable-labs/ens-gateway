// compare v1 solidity builder with js v1/v2 converter

import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {EVMRequest, EVMRequestV1} from '../../src/vm.js';

let foundry = await Foundry.launch();

async function extract_v1(code) {
	let c = await foundry.deploy({sol: `
		import {EVMFetcher} from "@src/evm-verifier0/EVMFetcher.sol";
		import {IEVMVerifier} from "@src/evm-verifier0/IEVMVerifier.sol";
		contract C {
			using EVMFetcher for EVMFetcher.EVMFetchRequest;
			function extract() pure external returns (bytes32[] memory, bytes[] memory) {
				EVMFetcher.EVMFetchRequest memory r = EVMFetcher.newFetchRequest(IEVMVerifier(address(0)), address(0));
				${code}
				if (r.commands.length > 0 && r.operationIdx < 32) {
					r.commands[r.commands.length-1] |= (bytes32(bytes1(uint8(255))) >> (8 * r.operationIdx++));
				}
				return (r.commands, r.constants);
			}
		}
	`});
	let res = await c.extract();
	return res.toArray(true);
}

async function compare(v1_code, v2_func, a = ethers.ZeroAddress) {	
	let [commands, constants] = await extract_v1(v1_code);
	let r1 = new EVMRequestV1(a, commands, constants).v2();
	let r2 = new EVMRequest();
	r2.push(a);
	r2.target();
	v2_func(r2);
	let enc1 = r1.encode();
	let enc2 = r2.encode();
	if (enc1 !== enc2) throw Object.assign(new Error('diff'), {v1_code, r1, r2});	
	console.log(v1_code);
	console.log(enc1);
	console.log();	
}

await compare(`
	r.getStatic(8);
`, r => {
	r.push(8);
	r.add();
	r.collect(0);
});

await compare(`
	r.getDynamic(1).element(2);
`, r => {
	r.push(1); r.add();
	r.push(2); r.follow();
	r.collect(1);
});

await compare(`
	r.getStatic(3).getStatic(4).ref(0);
`, r => {
	r.push(3); r.add(); r.collect(0);
	r.push(4); r.add(); r.push_output(0); r.follow(); r.collect(0);
});


await compare(`
	r.getDynamic(3).element(4).element(5);
	r.getStatic(6).element(bytes("raffy"));
`, r => {
	r.push(3); r.add(); r.push(4); r.follow(); r.push(5); r.follow(); r.collect(1);
	r.push(6); r.add(); r.push_str("raffy"); r.follow(); r.collect(0);
});

foundry.shutdown();
