import {Foundry, Resolver, Node} from '@adraffy/blocksmith';
import {serve, OPProver} from '../server/src/OPProver.js';
import {ethers} from 'ethers';

let foundry = await Foundry.launch({fork: 'https://cloudflare-eth.com'}); //, procLog: true});

let prover = OPProver.forBaseMainnet({
	provider1: foundry.provider,
});

let ccip = await serve(prover.ezccip, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'OPVerifier', args: [[ccip.endpoint], prover.L2OutputOracle]});

let teamnick = await foundry.deploy({file: 'TeamNick', args: [verifier]});

/*
let base = Node.create('teamnick.eth');
let resolver = new Resolver(base.create('raffy'), base, new ethers.Contract(teamnick, [
	'function supportsInterface(bytes4) view returns (bool)',
	'function resolve(bytes name, bytes data) view returns (bytes)',
	'function addr(bytes32 node, uint coinType) view returns (bytes)',
	'function addr(bytes32 node) view returns (address)',
	'function text(bytes32 node, string key) view returns (string)',
	'function contenthash(bytes32 node) view returns (bytes)',
	'function pubkey(bytes32 node) view returns (bytes32 x, bytes32 y)',
	'function name(bytes32 node) view returns (string)',
	'function multicall(bytes[] calldata data) external returns (bytes[] memory results)',
], foundry.provider), {wild: true, drop: 1});
console.log(await demo.prove('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f', 8n, {enableCcipRead: true}));
*/

let abi = new ethers.Interface([
	'function addr(bytes32 node, uint coinType) view returns (bytes)',
	'function addr(bytes32 node) view returns (address)',
	'function text(bytes32 node, string key) view returns (string)',
]);

async function read(name, func, arg) {
	let frag = abi.getFunction(func === 'addr' ? (arg === undefined ? 'addr(bytes32)' : 'addr(bytes32,uint256)') : func);
	let args = [ethers.namehash(name)];
	if (arg !== undefined) {
		args.push(arg);
		func += `(${arg})`;
	}
	let answer = await teamnick.resolve(ethers.dnsEncode(name, 255), abi.encodeFunctionData(frag, args), {enableCcipRead: true});
	let value = abi.decodeFunctionResult(frag, answer);
	if (frag.outputs.length == 1) value = value[0];
	return {name, func, value};
}


console.log(await read('raffy.teamnick.eth', 'addr', 60));
console.log(await read('raffy.teamnick.eth', 'addr'));
console.log(await read('raffy.teamnick.eth', 'text', 'avatar'));

console.log(await read('teamnick.eth', 'addr', 0x80000000n + 8453n));
console.log(await read('teamnick.eth', 'text', 'url'));

foundry.shutdown();
ccip.http.close();
