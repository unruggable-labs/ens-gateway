import {Foundry} from '@adraffy/blocksmith';

let foundry = await Foundry.launch();

let contract = await foundry.deploy({sol: `
	contract Test {
		function f(bytes memory v) external {
			abi.decode(v, (uint256, bytes));
		}
	}
`});

console.log(await contract.f('0x'));
