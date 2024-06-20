import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {provider_url, create_provider_pair, CHAIN_BASE} from '../../src/providers.js';
import {OPGateway} from '../../src/server4/OPGateway.js';

let foundry = await Foundry.launch({fork: provider_url(1), infoLog: true, procLog: false});
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
	import "@src/evm-verifier4/EVMRequestLib.sol";
	import "forge-std/console2.sol";
	contract Reader is EVMFetchTarget {
		using EVMRequestLib for EVMRequest;

		function read() external view returns (bytes[] memory, address, string memory) {
			EVMRequest memory r = EVMRequestLib.newRequest(2);
			r.push(address(${A})).target(); 
			r.read().target();
			r.offset(7).push(bytes("raffy")).keccak().follow()
				.read().setOutput(0)
				.offset(1).readBytes().setOutput(1);
			fetch(IEVMVerifier(${verifier.target}), r, this.readCallback.selector, '');
		}
		function readCallback(bytes[] memory m, uint8 exitCode, bytes calldata) external pure returns (bytes[] memory, address, string memory) {
			return (m, abi.decode(m[0], (address)), string(m[1]));
		}
	}
`});

console.log(await reader.read({enableCcipRead: true}));

foundry.shutdown();
ccip.http.close();
