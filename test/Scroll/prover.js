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

let req = new EVMRequest(2);
req.push('0x09D2233D3d109683ea95Da4546e7E9Fc17a6dfAF').target();
req.read().setOutput(0);
req.push('0x51050ec063d393217B436747617aD1C2285Aeeee').target();
req.offset(1337).read().read().read().setOutput(1);

let ctx = await prover.evalRequest(req);
console.log(ctx);

let values = await ctx.values();
console.log({values});

console.log(await prover.prove(ctx.needs));
