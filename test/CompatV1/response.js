// feed v1->v2 proofs into v1

import {Foundry} from '@adraffy/blocksmith';
import {EVMRequestV1, EVMProver} from '../../src/vm.js';
import {CHAIN_BASE, create_provider, provider_url} from '../../src/providers.js';

let foundry = await Foundry.launch({fork: provider_url(1)});

let verifier = await foundry.deploy({sol: `
	import {EVMProofHelper, StateProof} from "@src/evm-verifier0/EVMProofHelper.sol";
	contract X {
		function getStorageValues(address target, bytes32[] memory commands, bytes[] memory constants, bytes32 stateRoot, StateProof memory proof) pure external returns (bytes[] memory) {
			return EVMProofHelper.getStorageValues(target, commands, constants, stateRoot, proof);
		}
	}
`});

// TeamNickPointer: address(TeamNick)
await process_v1(new EVMRequestV1('0x0f1449c980253b576aba379b11d453ac20832a89').getStatic(0)); 

// TeamNick: baseURI()
await process_v1(new EVMRequestV1('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f').getDynamic(9));

async function process_v1(r1) {

	// use v2 prover
	let prover = await EVMProver.latest(create_provider(CHAIN_BASE));
	let r2 = r1.v2(); 
	let outputs = await prover.eval(r2.ops, r2.inputs);
	let [[accountProof], [[_, storageProofs]]] = await prover.prove(outputs);
	let {stateRoot} = await prover.getBlock();

	let values0 = await verifier.getStorageValues(r1.target, r1.commands, r1.constants, stateRoot, [accountProof, storageProofs]);
	let values1 = await EVMProver.resolved(outputs);

	console.log(values1.map((x, i) => {
		x.value0 = values0[i];
		return x;
	}));

}

foundry.shutdown();
