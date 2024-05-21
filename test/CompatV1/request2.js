import {EVMRequest, EVMRequestV1} from '../../src/vm.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';

test('getDynamic(8)', () => {
	let r1 = new EVMRequestV1();
	r1.getDynamic(8);

	let r2 = new EVMRequest();
	r2.push(r1.target); r2.target();
	r2.push(8); r2.add(); r2.collect(1);

	assert.deepEqual(r1.v2(), r2);
});

test('getDynamic(1).element(2)', () => {
	let r1 = new EVMRequestV1();
	r1.getDynamic(1).element(2);

	let r2 = new EVMRequest();
	r2.push(r1.target); r2.target();
	r2.push(1); r2.add(); r2.push(2); r2.follow(); r2.collect(1);

	assert.deepEqual(r1.v2(), r2);
});

test('getStatic(3).getStatic(4).ref(0)', () => {
	let r1 = new EVMRequestV1();
	r1.getStatic(3).getStatic(4).ref(0);

	let r2 = new EVMRequest();
	r2.push(r1.target); r2.target();
	r2.push(3); r2.add(); r2.collect(0);
	r2.push(4); r2.add(); r2.push_output(0); r2.follow(); r2.collect(0);

	assert.deepEqual(r1.v2(), r2);
});


test('getDynamic(3).element(4).element(5).getStatic(6).element(bytes("raffy"))', () => {
	let r1 = new EVMRequestV1();
	r1.getDynamic(3).element(4).element(5).getStatic(6).element_str("raffy");

	let r2 = new EVMRequest();
	r2.push(r1.target); r2.target();
	r2.push(3); r2.add(); r2.push(4); r2.follow(); r2.push(5); r2.follow(); r2.collect(1);
	r2.push(6); r2.add(); r2.push_str("raffy"); r2.follow(); r2.collect(0);

	assert.deepEqual(r1.v2(), r2);
});

