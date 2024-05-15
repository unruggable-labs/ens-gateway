pragma solidity ^0.8.23;

import "../../contracts/evm-verifier3/EVMFetcher.sol";

contract RequestBuilder {
	using EVMFetcher for GatewayRequest;
	function makeCall(address a) external pure returns (bytes memory) {
		GatewayRequest memory r = EVMFetcher.create();
		r.push(a); r.target(); 
		// #0: address (from pointer)
		r.collect(0); 
		// target = #0
		r.push_output(0); r.target();
		// #1: uint256 latest 
		r.collect(0);
		// #2: string name
		r.push(1); r.add(); r.collect(1);
		// #3: highscores[#1]
		r.push(2); r.add(); r.push_output(1); r.follow(); r.collect(0);
		// #4: highscorers[#1]
		r.push(3); r.add(); r.push_output(1); r.follow(); r.collect(1);
		// #5: realnames[#4]
		r.push(4); r.add(); r.push_output(4); r.follow(); r.collect(1);
		// #6: root.str
		r.push(12+1); r.add(); r.collect(1);
		// #7: root.map["a"].num
		r.push(12+2); r.add(); r.push_str("a"); r.follow(); r.collect(0);
		// #8: root.map["a"].map["b"].str
		r.push(12+2); r.add(); r.push_str("a"); r.follow();
			r.push(2); r.add(); r.push_str("b"); r.follow();
				r.push(1); r.add(); r.collect(1);
		// #9: highscorers[keccak(...)]
		r.push(3); r.add(); r.push_output(5); r.slice(0, 3); r.push_output(3); r.slice(16, 16); r.concat(); r.keccak(); r.follow(); r.collect(1);
		return r.encode('');
	}
}
