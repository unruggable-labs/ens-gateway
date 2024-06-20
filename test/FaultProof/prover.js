//import {ethers} from 'ethers';
import {create_provider_pair, CHAIN_OP} from '../../src/providers.js';
import {OPFaultGateway} from '../../src/server3/OPFaultGateway.js';
import {EVMProver, EVMRequest} from '../../src/vm.js';

let g = OPFaultGateway.op_mainnet(create_provider_pair(CHAIN_OP));

console.log(await g.disputeGameFactory.get());

let index = await g.latestGameIndex.get();

let game = await g.fetch_game(index, true);
console.log(game);

let prover = game.prover();

let req = new EVMRequest();
req.push('0xf9d79d8c09d24e0C47E32778c830C545e78512CF');
req.target();
req.push(0);
req.set();
req.collect(0);

let outputs = await prover.eval(req.ops, req.inputs);

console.log(await EVMProver.resolved(outputs));

