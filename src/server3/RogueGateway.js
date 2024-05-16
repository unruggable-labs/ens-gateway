import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';

export class RogueGateway extends EZCCIP {
	static random_response(n = 1024) {
		return new this('random', () => [ethers.randomBytes(Math.random() * n|0)]);
	}
	static empty_response() {
		return new this('empty', () => ['0x']);
	}
	constructor(name, handler) {
		super();
		this.register(`fetch(bytes context, tuple(bytes ops, bytes[] inputs)) returns (bytes)`, (args, context, history) => {
			history.show = [`${this.constructor.name}:${name}`];
			return handler(args, context, history);
		});
	}
}
