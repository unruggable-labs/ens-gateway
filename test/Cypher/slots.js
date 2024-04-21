import {ethers} from 'ethers';

let provider = new ethers.JsonRpcProvider('https://arbitrum-mainnet.infura.io/v3/eb26e787c3a14cc3bd74d3ee3c5b704d', 42161, {staticNetwork: true});

// https://arbiscan.io/address/0xec2244b547bd782fc7deefc6d45e0b3a3cbd488d#code
const address = '0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d';

// for (let i = 0; i < 16; i++) {
// 	console.log(i, await provider.getStorage(address, ethers.toBeHex(i, 32)));
// }
// console.log();

/*
0 0x43797068657250756e6b00000000000000000000000000000000000000000014
1 0x6370756e6b00000000000000000000000000000000000000000000000000000a
2 0x0000000000000000000000000000000000000000000000000000000000000000
3 0x0000000000000000000000000000000000000000000000000000000000000000
4 0x0000000000000000000000000000000000000000000000000000000000000000
5 0x0000000000000000000000000000000000000000000000000000000000000000
6 0x000000000000000000000092edd85597de05a471cc6779e7298b20316b970700
7 0x000000000000000000000000000000000000000000000000000000000000004a totalSupply
8 0x0000000000000000000000000000000000000000000000000000000000000045 baseURL
9 0x000000000000000000000000d00d726b2ad6c81e894dc6b87be6ce9c5572d2cd signer
10 mapping(bytes32 => mapping(string => string)) _texts;
11 mapping(bytes32 => mapping(uint256 => bytes)) _addrs;
12 mapping(bytes32 => bytes) _chashes;
13 mapping(uint256 => string) _names;
*/

const ID_TOKEN = ethers.id('slobo');
console.log(ID_TOKEN);

// SLOT_RECORDS[ID_RAFFY].addr = keccak(ID_RAFFY . SLOT_RECORDS)
// for (let i = 0; i < 10; i++) {
// 	console.log(i, await provider.getStorage(address, ethers.keccak256(ethers.concat([ID_TOKEN, ethers.toBeHex(i, 32)]))));
// }

let a = ethers.keccak256(ethers.concat([ID_TOKEN, ethers.toBeHex(2, 32)]));
console.log(a);
console.log(await provider.getStorage(address, a));

let b_latest = BigInt(await provider.getBlockNumber());
let b_proof = BigInt('0xc1d1376');
console.log(b_latest);
console.log(b_proof);
console.log(b_latest - b_proof);

console.log(await provider.getStorage(address, a, b_latest));
console.log(await provider.getStorage(address, a, b_proof));

// let a = ethers.keccak256(ethers.concat([ethers.id('slobo'), ethers.toBeHex(10, 32)]));
// let b = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes('avatar'), a]));
// console.log(await provider.getStorage(address, b));



