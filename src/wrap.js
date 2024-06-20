export function unwrap(x) {
	return x instanceof Wrapped ? x.get() : x;
}

export class Wrapped {
	constructor(init) {
		this.init = init;
		this.value = undefined;
	}
	get() {
		if (!this.value) {
			this.value = this.init();
		}
		return this.value;
	}
}
