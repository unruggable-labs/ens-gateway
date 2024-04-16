/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

abstract contract OffchainReader {

	error OffchainLookup(address from, string[] urls, bytes request, bytes4 callback, bytes carry);
	error OffchainNext();
	error OffchainEOL();

	function _nextPair(string[] memory urls) internal view returns (string[] memory rest, string[] memory pair) {
		if (urls.length == 0) revert OffchainEOL();
		uint256 index = block.number % urls.length;
		rest = new string[](urls.length - 1);
		for (uint256 i; i < index; i += 1) rest[i] = urls[i];
		for (uint256 i = index + 1; i < urls.length; i += 1) rest[i-1] = urls[i];
		pair = new string[](2);
		pair[0] = urls[index];
		pair[1] = "data:application/json,{\"data\":\"0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000021234000000000000000000000000000000000000000000000000000000000000\"}";
	}

	function lookupOffchain(string[] memory urls, bytes memory request, bytes4 callback, bytes memory carry) internal view {
		(string[] memory rest, string[] memory pair) = _nextPair(urls);
		revert OffchainLookup(address(this), pair, request, this.lookupCallback.selector, abi.encode(rest, request, callback, carry));
	}

	function lookupCallback(bytes calldata response, bytes calldata extra) external view {
		(string[] memory urls, bytes memory request, bytes4 callback, bytes memory carry) = abi.decode(extra, (string[], bytes, bytes4, bytes));
		if (keccak256(response) == 0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432) {
			// https://adraffy.github.io/keccak.js/test/demo.html#algo=keccak-256&s=0x1234&escape=1&encoding=hex
			lookupOffchain(urls, request, callback, carry);
		} else {
			(bool ok, bytes memory v) = address(this).staticcall(abi.encodeWithSelector(callback, response, carry));
			if (ok) {
				assembly { return(add(v, 32), mload(v)) }
			}
			if (bytes4(v) != OffchainNext.selector) {
				assembly { revert(add(32, v), mload(v)) }
			}
			lookupOffchain(urls, request, callback, carry);
		}
	}

}