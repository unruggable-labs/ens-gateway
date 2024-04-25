import {Foundry} from '@adraffy/blocksmith';
import {MultiExpander} from '../src/evm-storage-multi.js';
import {CHAIN_ARB1, create_provider_pair} from '../src/providers.js';
import {ethers} from 'ethers';

let {provider1, provider2} = create_provider_pair(CHAIN_ARB1);

// https://arbiscan.io/address/0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d

let foundry = await Foundry.launch();
let contract = await foundry.deploy({sol: `
	import {EVMFetcher} from '@src/evm-verifier3/EVMFetcher.sol';
	contract MultiTargetDemo {
		using EVMFetcher for EVMFetcher.Req;
		function debug() external pure returns (bytes memory) {
			EVMFetcher.Req memory r = EVMFetcher.create();
			
			uint256 token = uint256(keccak256(bytes("slobo")));

			r.push(0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d); 
			r.start(); 
				r.push(2); r.add();
				r.push(token);
			r.follow();
			r.end(0);
			
			r.input(0); 
			r.start(); 
				r.push(10); r.add();
				r.push(token); r.output(0); r.slice(12, 20); r.keccak(2);
			r.follow();
				r.push(bytes("avatar"));
			r.follow();
			r.end(1);

			return r.debug();
		}
	}
`});
let call = await contract.debug();
foundry.shutdown();

console.log({call});

let abi = new ethers.Interface([
	`function fetch(bytes memory context, 
		uint16 outputs,
		bytes memory ops, 
		bytes[] memory inputs
	) external pure returns (bytes memory witness)`
]);

let res = abi.decodeFunctionData('fetch', call);

// let L2OutputOracle = new ethers.Contract('0x56315b90c40730925ec5485cf004d835058518A0', [
// 	'function latestOutputIndex() external view returns (uint256)',
// 	'function getL2Output(uint256 outputIndex) external view returns (tuple(bytes32 outputRoot, uint128 t, uint128 block))',
// ], provider1);
// let output = await L2OutputOracle.latestOutputIndex();
// let {block} = await L2OutputOracle.getL2Output(output);
let block = ethers.toBeHex(204265879n);

let {outputs, ops, inputs} = res;
outputs = Number(outputs);
ops = ethers.getBytes(ops);

console.log({outputs, ops, inputs});

let me = new MultiExpander(provider2, block);

for (let output of await me.eval(outputs, ops, inputs)) {
	output.value = await output.value();
	console.log(output);
}