// import {ethers} from 'ethers';
// import {create_provider} from '../../src/providers.js';

// let provider1 = create_provider(1);

// // https://etherscan.io/address/0x3508174Fa966e75f70B15348209E33BC711AE63e#code
// let poseidon = new ethers.Contract('0x3508174Fa966e75f70B15348209E33BC711AE63e', [
// 	'function poseidon(uint256[2], uint256) external view returns (bytes32)'
// ], provider1);

// console.log(await poseidon.poseidon([1, 2], 4));

import {create_provider_pair, CHAIN_SCROLL} from '../../src/providers.js';
import {ScrollGateway} from '../../src/server4/ScrollGateway.js';

let gateway = ScrollGateway.mainnet(create_provider_pair(CHAIN_SCROLL));

console.log(await gateway.poseidon_hash(1, 2, 4));
