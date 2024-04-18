import {ethers} from 'ethers';

let provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, {staticNetwork: true});

const A = '0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f';

const SLOT_RECORDS = ethers.toBeHex(7, 32);

// struct Record {
//   address addr;
//   string avatar;
// }

for (let i = 0; i < 10; i++) {
	console.log(i, await provider.getStorage(A, ethers.toBeHex(i, 32)));
}
console.log();

const ID_RAFFY = ethers.id('raffy');

// SLOT_RECORDS[ID_RAFFY].addr = keccak(ID_RAFFY . SLOT_RECORDS)
console.log(await provider.getStorage(A, ethers.keccak256(ethers.concat([ID_RAFFY, SLOT_RECORDS]))));

// SLOT_RECORDS[ID_RAFFY].avatar = keccak(ID_RAFFY . SLOT_RECORDS) + 1
console.log(await provider.getStorage(A, ethers.toBeHex(BigInt(ethers.keccak256(ethers.concat([ID_RAFFY, SLOT_RECORDS]))) + 1n, 32)));

// SLOT_RECORDS[ID_RAFFY].avatar[0] = keccak(keccak(ID_RAFFY . SLOT_RECORDS) + 1)
console.log(await provider.getStorage(A, ethers.keccak256(ethers.toBeHex(BigInt(ethers.keccak256(ethers.concat([ID_RAFFY, SLOT_RECORDS]))) + 1n, 32))));

// SLOT_RECORDS[ID_RAFFY].avatar[0] = keccak(keccak(ID_RAFFY . SLOT_RECORDS) + 1) + 1
console.log(await provider.getStorage(A, ethers.toBeHex(BigInt(ethers.keccak256(ethers.toBeHex(BigInt(ethers.keccak256(ethers.concat([ID_RAFFY, SLOT_RECORDS]))) + 1n, 32))) + 1n, 32)));
