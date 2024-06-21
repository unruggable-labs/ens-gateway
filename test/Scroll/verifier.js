import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {provider_url, create_provider_pair, CHAIN_SCROLL} from '../../src/providers.js';
import {ScrollGateway} from '../../src/server4/ScrollGateway.js';

let foundry = await Foundry.launch({fork: provider_url(1), infoLog: true, procLog: false});
let gateway = ScrollGateway.mainnet(create_provider_pair(CHAIN_SCROLL));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({
	file: 'evm-verifier4/ScrollVerifier', 
	args: [[ccip.endpoint], gateway.ScrollChainCommitmentVerifier.target, 5, gateway.rollup_step]
});

// https://scrollscan.com/address/0x09D2233D3d109683ea95Da4546e7E9Fc17a6dfAF#code
const A = '0x09D2233D3d109683ea95Da4546e7E9Fc17a6dfAF';

let reader = await foundry.deploy({sol: `
	import "@src/evm-verifier4/EVMFetchTarget.sol";
	import "@src/evm-verifier4/EVMFetcher.sol";
	
	contract Reader is EVMFetchTarget {
		using EVMFetcher for EVMRequest;

		function test1() external view returns (bytes[] memory, uint8) {
			EVMRequest memory r = EVMFetcher.newRequest(3);
			r.push(address(${A}));
			r.push(0x51050ec063d393217B436747617aD1C2285Aeeee);
			r.push(0x0000000000000000000000000000000000000001);
			r.push(EVMFetcher.newCommand().target().requireContract()).eval(STOP_ON_SUCCESS | ACQUIRE_STATE);
			r.readTarget().setOutput(0);
			r.offset(69).readSlot().setOutput(1);
			r.zeroSlot().read().setOutput(2);
			fetch(IEVMVerifier(${verifier.target}), r, this.debugCallback.selector, '');
		}

		function test2() external view returns (bytes[] memory, uint8) {
			EVMRequest memory r = EVMFetcher.newRequest(3);
			r.push(address(${A})).target().offset(69).read().setOutput(0);
			fetch(IEVMVerifier(${verifier.target}), r, this.debugCallback.selector, '');
		}

		function debugCallback(bytes[] memory m, uint8 exitCode, bytes calldata) external pure returns (bytes[] memory, uint8) {
			return (m, exitCode);
		}
	}
`});

console.log(await reader.test1({enableCcipRead: true}));
console.log(await reader.test1({enableCcipRead: true}));
//console.log(await reader.test2({enableCcipRead: true}));

console.log('[CALL CACHE]');
console.log(gateway.call_cache.cached);

let index = gateway.commit_cache.cached.keys().next().value;
console.log({index});

console.log('[IS CONTRACT]');
console.log((await gateway.commit_cache.cachedValue(index)).slot_cache.cached);

foundry.shutdown();
ccip.http.close();

