import {ethers} from 'ethers';
import {create_provider_pair, create_provider, provider_url, CHAIN_SCROLL} from '../../src/providers.js';
//import {ScrollGateway} from '../../src/server4/ScrollGateway.js';
import {Foundry} from '@adraffy/blocksmith';

//let gateway = ScrollGateway.mainnet(create_provider_pair(CHAIN_SCROLL));

const POSEIDON = '0x3508174Fa966e75f70B15348209E33BC711AE63e';
//const MAGIC = ethers.id('THIS IS SOME MAGIC BYTES FOR SMT m1rRXgP2xpDI');
//console.log({MAGIC});

// https://etherscan.io/address/0x3508174Fa966e75f70B15348209E33BC711AE63e#code
// let poseidon = new ethers.Contract('0x3508174Fa966e75f70B15348209E33BC711AE63e', [
// 	'function poseidon(uint256[2], uint256) external view returns (bytes32)'
// ], provider1);
// console.log(await poseidon.poseidon([1, 2], 4));

let foundry = await Foundry.launch({fork: provider_url(1), procLog: true});

let contract = await foundry.deploy({sol: `
	import "@src/evm-verifier4/ZkTrieHelper.sol";
	contract X {
		function proveAccountState(bytes32 stateRoot, address account, bytes[] memory proof) external view returns (bytes32) {
			return ZkTrieHelper.proveAccountState(${POSEIDON}, stateRoot, account, proof);
		}
		function proveStorageValue(bytes32 storageRoot, uint256 slot, bytes[] memory proof) external view returns (uint256) {
			return uint256(ZkTrieHelper.proveStorageValue(${POSEIDON}, storageRoot, slot, proof));
		}
	}
`});

const A = '0x09D2233D3d109683ea95Da4546e7E9Fc17a6dfAF'; // contract
//const A = '0x51050ec063d393217B436747617aD1C2285Aeeee'; // eoa
//const A = '0x1337000000000000000000000000000000000000'; // doesn't exist

let provider2 = create_provider(CHAIN_SCROLL);
let block = await provider2.getBlock(6744000);
let block_hex = ethers.toBeHex(block.number);

console.log({
	block: block_hex,
	stateRoot: block.stateRoot
});

let slot_hex = ethers.toBeHex(0, 32); // exists
//let slot_hex = ethers.toBeHex(69, 32); // does not exist

let proof = await provider2.send('eth_getProof', [A, [slot_hex], block_hex]);

console.log(proof.accountProof);
console.log(proof.storageProof[0].proof);

if (0) {
	function compressProof(accountProof, storageProof) {
		return ethers.concat([
			ethers.toBeHex(accountProof.length, 1),
			...accountProof,
			ethers.toBeHex(storageProof.length, 1),
			...storageProof,
		]);
	}
	let ccv = new ethers.Contract('0xc4362457a91b2e55934bdcb7daaf6b1ab3ddf203', [
		'function rollup() view returns (address)',
		'function poseidon() view returns (address)',
		'function verifyZkTrieProof(address account, bytes32 storageKey, bytes calldata proof) external view returns (bytes32 stateRoot, bytes32 storageValue)'
	], foundry.provider);
	console.log(await ccv.verifyZkTrieProof(A, slot_hex, compressProof(proof.accountProof, proof.storageProof[0].proof)));
}

let storageRoot =  await contract.proveAccountState(block.stateRoot, A, proof.accountProof);

console.log({storageRoot});

console.log({getStorage: await provider2.getStorage(A, slot_hex, block_hex)});

//slot_hex = ethers.toBeHex(9, 32); // HACK
let value = 'unset';
if (storageRoot != ethers.ZeroHash) {
	value = await contract.proveStorageValue(storageRoot, slot_hex, proof.storageProof[0].proof);
}

console.log({
	storageRoot, 
	storageRoot0: proof.storageHash,
	// codeHash,
	// codeHash0: proof.keccakCodeHash,
	value,
	value0: BigInt(proof.storageProof[0].value)
});

foundry.shutdown();
