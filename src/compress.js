
class Memo extends Map {
	memo(key) {
		let i = this.get(key);
		if (i === undefined) this.set(key, i = this.size);
		return i;
	}
}

function uint16BEs_from(v) {
	let u = new Uint8Array(v.length << 1);
	let i = 0;
	for (let x of v) {
		u[i++] = x >> 8;
		u[i++] = x;
	}
	return u;
}

// 256 * 32 = 8192 bytes of data

export function compress_outputs(outputs) {
	let memo = new Memo();
	outputs = outputs.map(([account, slots]) => [
		account.map(x => memo.memo(x)), 
		...slots.map(slot => slot.map(x => memo.memo(x)))
	].map(v => new Uint8Array(v)));
	if (memo.size > 256) throw new Error('compress overflow');
	return [[...memo.keys()], outputs];
}