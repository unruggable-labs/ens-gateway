import {Foundry} from '@adraffy/blocksmith';
import {serve, create_prover} from '../server/src/server.js';
import {ethers} from 'ethers';

let foundry = await Foundry.launch({fork: 'https://cloudflare-eth.com'});

let provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, {staticNetwork: true});

let ccip = await serve(create_prover({provider}))