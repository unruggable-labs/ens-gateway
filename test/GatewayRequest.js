import {MultiExpander, GatewayRequest} from '../src/MultiExpander.js';
import {create_provider, CHAIN_BASE} from '../src/providers.js';
import {ethers} from 'ethers';

let provider = create_provider(CHAIN_BASE);

let r = GatewayRequest.create();
r.push('0x0f1449C980253b576aba379B11D453Ac20832a89'); r.focus(); // TeamNickPointer
r.collect(0); // read address
r.output(0); r.focus(); // TeamNick
r.push(9); r.add(); r.collect(1); // baseURI
r.push(8); r.add(); r.collect(0); // supply
console.log(r);

let me = new MultiExpander(provider, ethers.toBeHex(13901882));

let outputs = await me.eval(r.ops, r.inputs);

await Promise.all(outputs.map(async x => {
	x.value = await x.value();
}));
console.log(outputs);

console.log({
	teamnick: ethers.getAddress(ethers.toBeHex(outputs[0].value, 20)),
	baseURI: ethers.toUtf8String(outputs[1].value),
	supply: ethers.getNumber(outputs[2].value)
});
