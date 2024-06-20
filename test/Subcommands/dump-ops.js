import {readFileSync} from 'node:fs';

let code = readFileSync(new URL('../../contracts/evm-verifier4/EVMProtocol.sol', import.meta.url), {encoding: 'utf8'});

for (let match of code.matchAll(/uint8 constant (OP_[A-Z_]+)\s*=\s*(\d+)/g)) {
	console.log(`const ${match[1]} = ${match[2]};`);
}
