import {ethers} from 'ethers';
import {Foundry} from '@adraffy/blocksmith';
import {GatewayRequest, MultiExpander} from '../../src/MultiExpander.js';
import assert from 'node:assert/strict';
import {test, after} from 'node:test';

test('SlotDataReader', async () => {
	
	let foundry = await Foundry.launch();
	after(() => foundry.shutdown());

	// deploy storage example
	let storage = await foundry.deploy({file: 'SlotDataContract', args: [foundry.wallets.admin]});

	// deploy pointer to storage example
	let storage_pointer = await foundry.deploy({sol: `
		contract Pointer {
			address a;
			constructor(address _a) {
				a = _a;
			}
		}
	`, args: [storage]});

	// deploy solc code that builds requests
	let builder = await foundry.deploy({file: 'RequestBuilder'});

	// confirm js builder decoder/encoder sameness
	let call0 = await builder.makeCall(storage_pointer);
	test('GatewayRequest: encode(decode(x)) == x', () => assert.equal(call0, GatewayRequest.decode(call0).encode()));

	// confirm js builder is 1:1
	let r = GatewayRequest.create();
	r.push(storage_pointer.target); r.focus();
	/********************************************************************************/
	// #0: address (from pointer)
	r.collect(0); 
	// target = #0
	r.output(0); r.focus();
	// #1: uint256 latest 
	r.collect(0);
	// #2: string name
	r.push(1); r.add(); r.collect(1);
	// #3: highscores[#1]
	r.push(2); r.add(); r.output(1); r.follow(); r.collect(0);
	// #4: highscorers[#1]
	r.push(3); r.add(); r.output(1); r.follow(); r.collect(1);
	// #5: realnames[#4]
	r.push(4); r.add(); r.output(4); r.follow(); r.collect(1);
	// #6: root.str
	r.push(12+1); r.add(); r.collect(1);
	// #7: root.map["a"].num
	r.push(12+2); r.add(); r.push_str("a"); r.follow(); r.collect(0);
	// #8: root.map["a"].map["b"].str
	r.push(12+2); r.add(); r.push_str("a"); r.follow();
		r.push(2); r.add(); r.push_str("b"); r.follow();
			r.push(1); r.add(); r.collect(1);
	// #9: uint256(keccak256(abi.encodePacked("Hal", uint128(12345)))
	r.push(3); r.add(); r.output(5); r.slice(0, 3); r.output(3); r.slice(16, 16); r.concat(); r.keccak(); r.follow(); r.collect(1);
	/********************************************************************************/
	test('GatewayRequest: solc == js', () => assert.equal(call0, r.encode()));

	// execute the request
	let expander = await MultiExpander.latest(foundry.provider);
	let outputs = await MultiExpander.resolved(await expander.eval(r.ops, r.inputs));

	//console.log(outputs);

	//console.log(outputs);
	function decode_one(type, data) {
		return ethers.AbiCoder.defaultAbiCoder().decode([type], data)[0];
	}

	// decode all of the fields
	test('storage pointer',						() => assert.equal(decode_one('address', outputs[0].value), storage.target));
	test('uint256 latest = 49',					() => assert.equal(ethers.toBigInt(outputs[1].value), 49n));
	test('string name = "Satoshi"',				() => assert.equal(ethers.toUtf8String(outputs[2].value), 'Satoshi'));
	test('highscores[latest] = 12345',			() => assert.equal(ethers.toBigInt(outputs[3].value), 12345n));
	test('highscorers[latest] = "Satoshi"',		() => assert.equal(ethers.toUtf8String(outputs[4].value), 'Satoshi'));
	test('realnames["Satoshi"] = "Hal Finney"',	() => assert.equal(ethers.toUtf8String(outputs[5].value), 'Hal Finney'));
	test('root.str = "raffy"',					() => assert.equal(ethers.toUtf8String(outputs[6].value), 'raffy'));
	test('root.map["a"].num = 2',				() => assert.equal(ethers.toBigInt(outputs[7].value), 2n));
	test('root.map["a"].map["b"].str = "eth"',	() => assert.equal(ethers.toUtf8String(outputs[8].value), "eth"));
	test('highscorers[keccak(...)] = "chonk"',	() => assert.equal(ethers.toUtf8String(outputs[9].value), "chonk"));

});
