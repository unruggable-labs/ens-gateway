// CachedMap maintains 2 maps:
// 1) pending promises by key
// 2) settled promises by key + expiration
// requests for the same key return the same promise
// which may be from (1) or (2)
// too many pending {max_pending} are errors
// too many cached {max_cached} purge the oldest
// resolved promises are cached for {ms}
// rejected promises are cached for {ms_error}

const ERR = Symbol();

function clock() {
	return performance.now();
}

export class CachedValue {
	#exp = 0;
	#value = undefined;
	constructor(fn, {ms = 60000, ms_err = 1000} = {}) {
		this.fn = fn;
		this.ms_ok = ms;
		this.ms_err = ms_err;	
		this.clear();
	}
	clear() {
		// this also clears any pending results
		this.#value = undefined;
	}
	set(value) {
		this.#value = Promise.resolve(value);
		this.#exp = clock() + this.ms_ok; // start cooldown
	}
	get value() {
		return this.#value;
	}
	async get() {
		if (this.#value) {
			if (this.#exp > clock()) return this.#value;
			this.#value = undefined;
		}
		let p = this.#value = this.fn();
		return p.catch(() => ERR).then(x => {
			if (this.#value === p) {
				this.#exp = clock() + (x === ERR ? this.ms_err : this.ms_ok);
			}
			return p;
		});
	}
}

export class CachedMap {
	constructor({ms = 60000, ms_error, ms_slop = 50, max_cached = 10000, max_pending = 100} = {}) {
		this.cached = new Map();
		this.pending = new Map();
		this.timer = undefined;
		this.timer_t = Infinity;
		this.ms_success = ms;
		this.ms_error = ms_error ?? Math.ceil(ms / 4);
		this.ms_slop = ms_slop;
		this.max_cached = max_cached;
		this.max_pending = max_pending;
	}
	_schedule(exp) {
		let now = clock();
		let t = Math.max(now + this.ms_slop, exp);
		//console.log('schedule', {dur: t - now});
		if (this.timer_t < t) return; // scheduled and shorter
		//console.log('restart', {fire: this.timer_t, t});
		clearTimeout(this.timer); // kill old
		this.timer_t = t; // remember fire time
		this.timer = setTimeout(() => {
			let {cached} = this;
			let now = clock();
			let min = Infinity;
			for (let [key, [exp]] of cached) {
				if (exp < now) {
					cached.delete(key);
				} else {
					min = Math.min(min, exp); // find next
				}
			}
			//console.log('fired', {min, n: cached.size});
			this.timer_t = Infinity;
			if (cached.size) {
				this._schedule(min); // schedule for next
			} else {
				clearTimeout(this.timer);
				//console.log('done');
			}
		}, t - now).unref(); // schedule
	}
	clear() {
		this.cached.clear();
		this.pending.clear();
		clearTimeout(this.timer);
		this.timer_t = Infinity;
	}
	add(key, value, ms) {
		if (!ms) ms = this.ms_success;
		let {cached, max_cached} = this;
		if (cached.size >= max_cached) { // we need room
			for (let key of [...cached.keys()].slice(-Math.ceil(max_cached/16))) { // remove batch
				cached.delete(key);
			}
		}
		let exp = clock() + ms;
		cached.set(key, [exp, value]); // add cache entry
		this._schedule(exp);
	}
	cachedValue(key) {
		let c = this.cached.get(key);
		if (c) {
			let [exp, q] = c;
			if (exp > clock()) return q; // still valid
			this.cached.delete(key); // expired
		}
		return; // ree
	}
	peek(key) {
		return this.cachedValue(key) ?? this.pending.get(key);
	}
	get(key, fn, ms) {
		let p = this.peek(key);
		if (p) return p;
		if (this.pending.size >= this.max_pending) throw new Error('busy'); // too many in-flight
		let q = fn(key); // begin
		p = q.catch(() => ERR).then(x => { // we got an answer
			if (this.pending.delete(key)) { // remove from pending
				this.add(key, q, x && x !== ERR ? (ms ?? this.ms_success) : this.ms_error); // add original to cache if existed
			}
			return q; // resolve to original
		});
		this.pending.set(key, p); // remember in-flight
		return p;
	}
}
