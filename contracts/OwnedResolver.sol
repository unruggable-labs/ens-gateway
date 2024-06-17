/// @author raffy.eth
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/AddrResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/ContentHashResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/NameResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/PubkeyResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/TextResolver.sol";

contract OwnedResolver is Ownable, AddrResolver, ContentHashResolver, NameResolver, PubkeyResolver, TextResolver {
	constructor() Ownable(msg.sender) {		
	}
	function isAuthorised(bytes32) internal view override returns (bool) {
		return msg.sender == owner();
	}
	function supportsInterface(bytes4 x) public view virtual override(AddrResolver, ContentHashResolver, NameResolver, PubkeyResolver, TextResolver) returns (bool) {
		return super.supportsInterface(x);
	}
}
