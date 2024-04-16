import {Foundry} from '@adraffy/blocksmith';
import {serve, EZCCIP} from '@resolverworks/ezccip';
import assert from 'node:assert/strict';

const EXPECT = 69420n;

let foundry = await Foundry.launch();

let contract = await foundry.deploy({sol: `
	import {OffchainReader} from '@src/OffchainReader.sol';
	interface Chonk {
		function chonk() external returns (uint256);
	}
	contract Test is OffchainReader {
		function f(string[] calldata urls) external view returns (uint256) {
			lookupOffchain(urls, abi.encodeCall(Chonk.chonk, ()), this.fCallback.selector, '');
		}
		function fCallback(bytes calldata response, bytes calldata) external view returns (uint256 answer) {
			answer = uint256(bytes32(response));
			if (answer != ${EXPECT}) revert OffchainNext();
		}
	}
`});

let ezccip = new EZCCIP();
ezccip.register('chonk() returns (uint256)', () => [EXPECT]);
let ccip_raw = await serve(ezccip, {protocol: 'raw', log: false});
let ccip_tor = await serve(ezccip, {protocol: 'tor', log: false});

const urls = [
	'https://ethereum.org/', // not a ccip server
	ccip_tor.endpoint,       // returns signed response
	ccip_raw.endpoint        // returns expected response
];

const stack = [];
foundry.provider.on('debug', x => {
	if (x.action === 'sendCcipReadFetchRequest') {
		stack.push(urls.indexOf(x.urls[x.index]));
	}
});

for (let i = 0; i < 10; i++) {
	foundry.provider.send('anvil_mine', ['0x1']);
	stack.length = 0;
	assert.equal(await contract.f(urls, {enableCcipRead: true}), EXPECT);
	console.log(stack);
}

foundry.shutdown();
ccip_raw.http.close();
ccip_tor.http.close();
