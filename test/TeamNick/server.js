import {serve} from '@resolverworks/ezccip';
import {OPGateway} from '../../src/server2/OPGateway.js';
import {expand_slots} from '../../src/evm-storage.js';
import {ethers} from 'ethers';

let prover = OPGateway.forBaseMainnet({	
	//provider1: new ethers.JsonRpcProvider('https://cloudflare-eth.com', 1, {staticNetwork: true}),
	//provider2: new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, {staticNetwork: true}),
	expander: expand_slots
});

let ccip = await serve(prover, {protocol: 'raw', port: 8018});

