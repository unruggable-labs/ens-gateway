import {Foundry, Resolver, Node} from '@adraffy/blocksmith';
import {serve, OPProver} from '../server/src/OPProver.js';
import {ethers} from 'ethers';

//import {test, after} from 'node:test';

let foundry = await Foundry.launch(); //, procLog: true});


let contract = await foundry.deploy({sol: `
import {BatchGetStorage} from '@src/BatchGetStorage.sol';
import {EVMFetcher} from '@src/evm-verifier/EVMFetcher.sol';

contract BatchTest is BatchGetStorage {
	struct A {
		uint256 u;
		address a;
		string s;	
	}
	mapping(uint256 x => A) as;

	constructor() {
		as[1].u = 1;
		as[2].a = address(2);
		as[3].s = "chonk";
	}

}
`});

