import {MultiExpander, GatewayRequest} from '../../src/MultiExpander.js';
import {create_provider, CHAIN_BASE} from '../../src/providers.js';
import {ethers} from 'ethers';
import {writeFileSync} from 'node:fs';

let provider = create_provider(CHAIN_BASE);

let r = GatewayRequest.create();
r.push('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f'); 
r.focus();
for (let i = 0; i < 10; i++) {
	r.push(i);
	r.add();
	r.collect(0);
}
console.log(r);

let me = new MultiExpander(provider, ethers.toBeHex(13901882));

let outputs = await me.eval(r.ops, r.inputs);

let [accountProofs, stateProofs] = await me.prove(outputs);

console.log(stateProofs.map(x => x[1].length));

function decode(v) {
	return v.map(s => ethers.decodeRlp(s));
}

accountProofs = accountProofs.map(decode);
let storageProofs = stateProofs.map(x => decode(x[1][0]));


writeFileSync(new URL('./Multiproof.json', import.meta.url), JSON.stringify({
	accountProofs,
	storageProofs
}));
