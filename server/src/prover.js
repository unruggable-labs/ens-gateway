import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';

class InstrReader {
	constructor(v) {

	}
}

export function create_prover({provider}) {
	let ezccip = new EZCCIP();
	ezccip.register('prove(bytes instr, bytes32[] stack)', async ([instr, stack]) => {

		let r = new InstrReader(ethers.getB)



	});
	return ezccip;
}

