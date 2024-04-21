import {Foundry} from '@adraffy/blocksmith';
import {ethers} from 'ethers';

let foundry = await Foundry.launch();
let contract = await foundry.deploy({sol: `
	contract C {
		function f() external pure returns (bytes memory) {
			return abi.decode(new bytes(64), (bytes));
		}
	}
`});
console.log(await contract.f());
foundry.shutdown();


const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

for (let i = 0; i < 4; i++) {
	let ok = false;
	try {
		ABI_CODER.decode(['bytes'], '0x'.padEnd(2 + 64 * i, '0'));
		ok = true;
	} catch (err) {
	}
	console.log(i, ok);
}
