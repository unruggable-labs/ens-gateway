import {Foundry} from '@adraffy/blocksmith';
import {OPGateway} from '../src/server3/OPGateway.js';
import {MultiExpander} from '../src/MultiExpander.js';
import {CHAIN_BASE, create_provider_pair} from '../src/providers.js';
import {ethers} from 'ethers';

let gateway = OPGateway.base_mainnet(create_provider_pair(CHAIN_BASE));

// https://basescan.org/address/0x0f1449c980253b576aba379b11d453ac20832a89#code
// https://basescan.org/address/0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f#code

let foundry = await Foundry.launch();
let contract = await foundry.deploy({sol: `
	import "@src/evm-verifier3/EVMFetcher.sol";
	contract Test {
		using EVMFetcher for GatewayRequest;
		function makeCall() external pure returns (bytes memory) {
			GatewayRequest memory r = EVMFetcher.create();
			r.push(0x0f1449C980253b576aba379B11D453Ac20832a89); r.start(); r.end(0);
			r.output(0); r.start(); r.push(8); r.add(); r.end(0);
			r.output(0); r.start(); r.push(9); r.add(); r.end(1);
			r.output(0); r.start(); r.push(7); r.add(); r.push(uint256(keccak256(bytes("raffy")))); r.follow(); r.end(0);
			r.output(0); r.start(); r.push(7); r.add(); r.push(uint256(keccak256(bytes("raffy")))); r.follow(); r.push(1); r.add(); r.end(1);
			return r.encode('');
		}
	}
`});
let call = await contract.makeCall();
foundry.shutdown();

console.log({call});

let abi = new ethers.Interface([
	`function fetch(bytes context, tuple(bytes ops, bytes[] inputs) request)`
]);

let res = abi.decodeFunctionData('fetch', call);
console.log(res.toObject());

let {block} = await gateway.fetch_output(await gateway.latest_index());
//let block = ethers.toBeHex(13491000n);

let me = new MultiExpander(gateway.provider2, block);

let outputs = await me.eval(ethers.getBytes(res.request.ops), res.request.inputs);

for (let output of outputs) {
	output.value = await output.value();
	console.log(output);
}

let [accountProofs, stateProofs] = await me.prove(outputs);

console.log({
	accounts: accountProofs.length, 
	slots: stateProofs.map(([account, proofs]) => ({account, slots: proofs.length}))
});

/*
let [values, indexes] = compress_outputs(await me.prove(outputs));
console.log(values.map((x, i) => [i, (x.length - 2)>>1]));
console.log((values.reduce((a, x) => a + x.length, 0) - 2)>>1);
console.log(indexes);
*/
