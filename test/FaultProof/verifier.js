import {Foundry} from '@adraffy/blocksmith';
import {serve} from '@resolverworks/ezccip';
import {provider_url, create_provider_pair, CHAIN_OP} from '../../src/providers.js';
import {SuperchainGateway} from '../../src/server3/SuperchainGateway.js';

let foundry = await Foundry.launch({fork: provider_url(1), infoLog: true, procLog: false});
let gateway = SuperchainGateway.op_mainnet(create_provider_pair(CHAIN_OP));

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({
	file: 'evm-verifier3/SuperchainVerifier', 
	args: [[ccip.endpoint], gateway.optimismPortal.target, 0]
});

// https://optimistic.etherscan.io/address/0xf9d79d8c09d24e0C47E32778c830C545e78512CF#code
const A = '0xf9d79d8c09d24e0C47E32778c830C545e78512CF';

let reader = await foundry.deploy({sol: `
	import "@src/evm-verifier3/EVMFetchTarget.sol";
	contract Reader is EVMFetchTarget {
		using EVMFetcher for GatewayRequest;

		function read() external view returns (uint256) {
			GatewayRequest memory r = EVMFetcher.create();
			r.push(address(${A})); 
			r.target(); 
			r.collect(0);
			fetch(IEVMVerifier(${verifier.target}), r, this.readCallback.selector, '');
		}
		function readCallback(bytes[] memory v) external pure returns (uint256) {
			return uint256(bytes32(v[0]));
		}
	}
`});

console.log(await reader.read({enableCcipRead: true}));

foundry.shutdown();
ccip.http.close();
