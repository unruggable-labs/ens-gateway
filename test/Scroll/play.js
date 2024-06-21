import {ethers} from 'ethers';
import {CHAIN_SCROLL, create_provider_pair} from '../../src/providers.js';
import {ScrollGateway} from '../../src/server4/ScrollGateway.js';
import {EVMRequest} from '../../src/vm2.js';

let g = ScrollGateway.mainnet(create_provider_pair(CHAIN_SCROLL));

let index = await g.latest_index.get();
console.log({index});

let block = await g.block_from_index(index);
console.log({block});

console.log(await g.fetch_commit(index));

let prover = await g.latest_prover();

let req = new EVMRequest(1);
req.push('0x09D2233D3d109683ea95Da4546e7E9Fc17a6dfAF').target();
req.read().setOutput(0);

let ctx = await prover.evalRequest(req);

console.log(ctx);
console.log(await ctx.values());
