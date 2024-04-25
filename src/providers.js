import {ethers} from 'ethers';
import {ENV} from './env.js';

export const CHAIN_ARB1 = 42161;
export const CHAIN_BASE = 8453;

export function provider_url(chain) {
	if (!Number.isInteger(chain)) throw new Error('expected chain');
	if (ENV.INFURA_KEY) {
		try {
			return ethers.InfuraProvider.getRequest(ethers.Network.from(chain), ENV.INFURA_KEY).url;
		} catch (err) {
		}
	}
	if (ENV.ALCHEMY_KEY) {
		try {
			return ethers.AlchemyProvider.getRequest(ethers.Network.from(chain), ENV.ALCHEMY_KEY).url;
		} catch (err) {
		}
	}
	let key = ENV[`ALCHEMY_KEY_${chain}`];
	if (key) {
		return ethers.AlchemyProvider.getRequest(ethers.Network.from(chain), key).url;
	}
	switch (chain) {
		case 1: return 'https://cloudflare-eth.com';
		case CHAIN_BASE: return 'https://mainnet.base.org';
		case CHAIN_ARB1: return 'https://arb1.arbitrum.io/rpc';
	}
	throw Object.assign(new Error('unknown provider'), {chain});
}

export function create_provider(chain) {
	return new ethers.JsonRpcProvider(provider_url(chain), chain, {staticNetwork: true});
}

export function create_provider_pair(a, b) {
	if (!b) {
		b = a;
		a = 1;
	}
	return {
		provider1: create_provider(a),
		provider2: create_provider(b)
	};
}
