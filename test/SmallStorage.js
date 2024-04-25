import {Foundry} from '@adraffy/blocksmith';
import {ethers} from 'ethers';

let foundry = await Foundry.launch();
let contract = await foundry.deploy({sol: `
	contract C {
		uint32[] values;
		constructor() {
			uint32[] memory v = new uint32[](10);
			for (uint256 i = 0; i < v.length; i++) {
				v[i] = uint32(i + 1);
			}
			values = v;
		}
	}
`});

console.log(await foundry.provider.getStorage(contract.target, ethers.toBeHex(0)));
console.log(await foundry.provider.getStorage(contract.target, ethers.solidityPackedKeccak256(['uint256'], [0])));
console.log(await foundry.provider.getStorage(contract.target, ethers.toBeHex(1n + BigInt(ethers.solidityPackedKeccak256(['uint256'], [0])))));;

foundry.shutdown();
