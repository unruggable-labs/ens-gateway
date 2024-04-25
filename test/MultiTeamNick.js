import {Foundry} from '@adraffy/blocksmith';
import {MultiExpander} from '../src/MultiExpander.js';
import {CHAIN_BASE, create_provider_pair} from '../src/providers.js';
import {ethers} from 'ethers';

let {provider1, provider2} = create_provider_pair(CHAIN_BASE);

// https://basescan.org/address/0x0f1449c980253b576aba379b11d453ac20832a89#code
// https://basescan.org/address/0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f#code

let foundry = await Foundry.launch();
let contract = await foundry.deploy({sol: `
	import {EVMFetcher} from '@src/evm-verifier3/EVMFetcher.sol';
	contract MultiTargetDemo {
		using EVMFetcher for EVMFetcher.Req;
		function f() external pure returns (bytes memory) {
			EVMFetcher.Req memory r = EVMFetcher.create();
			r.push(0x0f1449C980253b576aba379B11D453Ac20832a89); r.start(); r.end(0);
			r.output(0); r.start(); r.push(8); r.add(); r.end(0);
			r.output(0); r.start(); r.push(9); r.add(); r.end(1);
			r.output(0); r.start(); r.push(7); r.add(); r.push(uint256(keccak256(bytes("raffy")))); r.follow(); r.end(0);
			r.output(0); r.start(); r.push(7); r.add(); r.push(uint256(keccak256(bytes("raffy")))); r.follow(); r.push(1); r.add(); r.end(1);
			return r.encode('');
		}
	}
`});
let call = await contract.f();
foundry.shutdown();

console.log({call});


let abi = new ethers.Interface([
	`function fetch(bytes memory context, 
		uint16 expected,
		bytes memory ops, 
		bytes[] memory inputs
	) external pure`
]);

let res = abi.decodeFunctionData('fetch', call);

// let L2OutputOracle = new ethers.Contract('0x56315b90c40730925ec5485cf004d835058518A0', [
// 	'function latestOutputIndex() external view returns (uint256)',
// 	'function getL2Output(uint256 outputIndex) external view returns (tuple(bytes32 outputRoot, uint128 t, uint128 block))',
// ], provider1);
// let output = await L2OutputOracle.latestOutputIndex();
// let {block} = await L2OutputOracle.getL2Output(output);
let block = ethers.toBeHex(13491000n);

let {ops, inputs} = res;
ops = ethers.getBytes(ops);

console.log({ops, inputs});

let me = new MultiExpander(provider2, block);

let outputs = await me.eval(ops, inputs);

console.log(outputs);

for (let output of outputs) {
	output.value = await output.value();
	console.log(output);
}

console.log(await me.prove(outputs));

