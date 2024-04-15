import {Foundry} from '@adraffy/blocksmith';
import {serve, OPProver} from '../server/src/OPProver.js';

let foundry = await Foundry.launch({fork: 'https://cloudflare-eth.com'});

let prover = OPProver.forBaseMainnet({
	provider1: foundry.provider,
});

let ccip = await serve(prover.ezccip, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'OPVerifier', args: [[ccip.endpoint], prover.L2OutputOracle]});

let tester = await foundry.deploy({file: 'FetchTest', args: [verifier]});

console.log(await tester.supply({enableCcipRead: true}));
console.log(await tester.name({enableCcipRead: true}));

foundry.shutdown();
ccip.http.close();
