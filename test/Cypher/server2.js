import {serve} from '@resolverworks/ezccip';
import {Arb1Gateway} from '../../src/server2/Arb1Gateway.js';
import {create_provider_pair, CHAIN_ARB1} from '../../src/providers.js';
import {ENV} from '../../src/env.js';

let prover = Arb1Gateway.mainnet(create_provider_pair(CHAIN_ARB1));

let ccip = await serve(prover, {protocol: 'raw', port: parseInt(ENV.PORT_ARB1 ?? 8019)});

//console.log(await prover.cached(BigInt('0x34a9')));
