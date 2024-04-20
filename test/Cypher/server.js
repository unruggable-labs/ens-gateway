import {serve} from '@resolverworks/ezccip';
import {Arb1Gateway} from '../../src/server2/Arb1Gateway.js';
import {expand_slots} from '../../src/evm-storage.js';

let prover = Arb1Gateway.mainnet({
	expander: expand_slots
});

let ccip = await serve(prover, {protocol: 'raw', port: 8019});

//console.log(await prover.cached(BigInt(0x34a8)));