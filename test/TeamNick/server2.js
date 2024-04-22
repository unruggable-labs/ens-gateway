import {serve} from '@resolverworks/ezccip';
import {OPGateway} from '../../src/server2/OPGateway.js';
import {CHAIN_BASE, create_provider_pair} from '../../src/providers.js';
import {ENV} from '../../src/env.js';

let gateway = OPGateway.base_mainnet(create_provider_pair(CHAIN_BASE));

let ccip = await serve(gateway, {protocol: 'raw', port: parseInt(ENV.PORT_BASE ?? 8018)});
