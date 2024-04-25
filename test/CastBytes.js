import {Foundry} from '@adraffy/blocksmith';

let foundry = await Foundry.launch();

let contract = await foundry.deploy({sol: `
	contract Test {
		function f(bytes memory v) external view returns (bytes32) {
			return bytes32(uint256(bytes32(v) >> 96));
		}
	}
`});

let v = new Uint8Array(100);
for (let i = 0; i < v.length; i++) {
	v[i] = i + 1;
}
for (let i = 0; i < 64; i++) {
	console.log(i, await contract.f(v.slice(0, i)));
}

foundry.shutdown();
