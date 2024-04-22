import {Foundry} from '@adraffy/blocksmith';
import {ethers} from 'ethers';

let foundry = await Foundry.launch();
let contract = await foundry.deploy({file: 'MultiTargetDemo', args: [ethers.ZeroAddress]});

console.log(await contract.debug());

foundry.shutdown();
