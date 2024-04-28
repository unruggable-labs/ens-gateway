import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';

export class RogueGateway extends EZCCIP {
	static random_response(n = 1024) {
		return new this(() => [ethers.randomBytes(Math.random() * n|0)]);
	}
	static empty_response() {
		return new this(() => ['0x']);
	}
	constructor(handler) {
		super();
		this.register(`fetch(bytes context, tuple(bytes ops, bytes[] inputs)) returns (bytes)`, handler);
	}
}
