import {Foundry} from '@adraffy/blocksmith';
import {Arb1Gateway} from '../src/server3/Arb1Gateway.js';
import {MultiExpander} from '../src/MultiExpander.js';
import {CHAIN_ARB1, create_provider_pair} from '../src/providers.js';
import {ethers} from 'ethers';

let gateway = Arb1Gateway.mainnet(create_provider_pair(CHAIN_ARB1));

// https://arbiscan.io/address/0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d

let foundry = await Foundry.launch();
let contract = await foundry.deploy({sol: `
	import "@src/evm-verifier3/EVMFetcher.sol";
	contract Test {
		using EVMFetcher for GatewayRequest;
		address constant CYPHER_NFT = 0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d;
		uint256 constant SLOT_OWNERS  =  2; // mapping(uint256 tokenId => address) private _owners;
		uint256 constant SLOT_SUPPLY  =  7;
		uint256 constant SLOT_TEXTS   = 10; // mapping(bytes32 => mapping(string => string)) _texts;
		uint256 constant SLOT_ADDRS   = 11; // mapping(bytes32 => mapping(uint256 => bytes)) _addrs;
		uint256 constant SLOT_CHASHES = 12; // mapping(bytes32 => bytes) _chashes;
		uint256 constant SLOT_NAMES   = 13; // mapping(uint256 => string) _names;	
		function makeCall() external pure returns (bytes memory) {
			GatewayRequest memory r = EVMFetcher.create();
			uint256 token = uint256(keccak256(bytes("slobo")));
			r.push(CYPHER_NFT); r.start(); r.push(SLOT_OWNERS); r.add(); r.push(token); r.follow(); r.end(0);
			r.push(CYPHER_NFT); r.start();
				r.push(SLOT_ADDRS); r.add(); r.push(token); r.output(0); r.slice(12, 20); r.concat(); r.keccak(); r.follow(); 
				r.push(60); r.follow();
				r.end(1);
			r.push(CYPHER_NFT); r.start();
				r.push(SLOT_TEXTS); r.add(); r.push(token); r.output(0); r.slice(12, 20); r.concat(); r.keccak(); r.follow(); 
				r.push(bytes("com.twitter")); r.follow();
				r.end(1);
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

let {block} = await gateway.fetch_node(await gateway.latest_index());
//let block = '0xc41bfaa';

let me = new MultiExpander(gateway.provider2, block);

let outputs = await me.eval(ethers.getBytes(res.request.ops), res.request.inputs);

for (let output of outputs) {
	output.value = await output.value();
	console.log(output);
}
