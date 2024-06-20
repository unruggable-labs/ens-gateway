import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {provider_url, create_provider_pair, CHAIN_BASE} from '../../src/providers.js';
import {OPGateway} from '../../src/server4/OPGateway.js';

let foundry = await Foundry.launch({fork: provider_url(1), infoLog: true, procLog: true});
let gateway = OPGateway.base_mainnet(create_provider_pair(CHAIN_BASE));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({
	file: 'evm-verifier4/OPVerifier', 
	args: [[ccip.endpoint], gateway.L2OutputOracle.target, 0]
});

// https://basescan.org/address/0x0f1449C980253b576aba379B11D453Ac20832a89
const A = '0x0f1449C980253b576aba379B11D453Ac20832a89';

let reader = await foundry.deploy({sol: `
	import "@src/evm-verifier4/EVMFetchTarget.sol";
	import "@src/evm-verifier4/EVMFetcher.sol";
	import "forge-std/console2.sol";
	contract Reader is EVMFetchTarget {
		using EVMFetcher for EVMRequest;

		function read() external view returns (bytes[] memory, uint8) {
			EVMRequest memory r = EVMFetcher.newRequest(2);
			r.push(address(${A}));
			r.push(0x51050ec063d393217B436747617aD1C2285Aeeee);
			r.push(0x0000000000000000000000000000000000000001);
			r.push(EVMFetcher.newCommand().target().requireContract()).eval(STOP_ON_SUCCESS | ACQUIRE_STATE);
			r.readTarget().setOutput(0);
			r.offset(69).readSlot().setOutput(1);
			fetch(IEVMVerifier(${verifier.target}), r, this.readCallback.selector, '');
		}
		function readCallback(bytes[] memory m, uint8 exitCode, bytes calldata) external pure returns (bytes[] memory, uint8) {
			return (m, exitCode);
		}
	}
`});

console.log(await reader.read({enableCcipRead: true}));

foundry.shutdown();
ccip.http.close();
