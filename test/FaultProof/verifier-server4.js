import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {provider_url, create_provider_pair, CHAIN_OP} from '../../src/providers.js';
import {OPFaultGateway} from '../../src/server4/OPFaultGateway.js';

let foundry = await Foundry.launch({fork: provider_url(1), infoLog: true, procLog: false});
let gateway = OPFaultGateway.mainnet(create_provider_pair(CHAIN_OP));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({
	file: 'evm-verifier4/OPFaultVerifier', 
	args: [[ccip.endpoint], gateway.optimismPortal.target, 0]
});

// https://optimistic.etherscan.io/address/0xf9d79d8c09d24e0C47E32778c830C545e78512CF#code
const A = '0xf9d79d8c09d24e0C47E32778c830C545e78512CF';

let reader = await foundry.deploy({sol: `
	import "@src/evm-verifier4/EVMFetchTarget.sol";
	import "@src/evm-verifier4/EVMFetcher.sol";
	
	contract Reader is EVMFetchTarget {
		using EVMFetcher for EVMRequest;

		function read() external view returns (bytes[] memory, uint8) {
			EVMRequest memory r = EVMFetcher.newRequest(2);
			r.push(address(${A})).target(); 
			r.read().setOutput(0);
			r.offset(1).readBytes().setOutput(1);
			fetch(IEVMVerifier(${verifier.target}), r, this.readCallback.selector, '');
		}
		function readCallback(bytes[] memory m, uint8 exitCode, bytes memory) external pure returns (bytes[] memory, uint8) {
			return (m, exitCode);
		}
	}
`});

console.log(await reader.read({enableCcipRead: true}));

foundry.shutdown();
ccip.http.close();
