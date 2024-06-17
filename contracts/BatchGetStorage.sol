/// @author raffy.eth
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

abstract contract BatchGetStorage {
	
	error InvalidOp(uint256 op);
	error InvalidConstant(bytes v);
	
	function expandSlots(bytes32[] memory commands, bytes[] memory constants) external view returns (bytes[] memory m) {
		uint256 n = commands.length;
		m = new bytes[](n);
		for (uint256 i; i < n; ++i) {
			(uint256 slot, bool dynamic) = computeFirstSlot(commands[i], constants, m);
			if (dynamic) {
				bytes storage v;
				assembly { v.slot := slot }
				m[i] = abi.encodePacked(slot, v);
			} else {
				bytes memory v = new bytes(64);
				assembly {
					mstore(add(v, 32), slot)
					mstore(add(v, 64), sload(slot))
				}
				m[i] = v;
			}
		}
	}

	function computeFirstSlot(bytes32 command, bytes[] memory constants, bytes[] memory m) internal pure returns (uint256 slot, bool dynamic) {
		dynamic = uint8(command[0]) & 1 != 0;
		for (uint256 i = 1; i < 32; i += 1) {
			uint256 op = uint8(command[i]);
			if (op == 0xFF) break;
			uint256 operand = op & 0x1F;
			op >>= 5;
			if (op == 0) {
				slot = uint256(keccak256(abi.encodePacked(constants[operand], slot)));
			} else if (op == 1) {
				bytes memory v = m[i];
				bytes memory u = abi.encodePacked(v);
				assembly {
					u := add(u, 32)
					mstore(u, sub(mload(v), 32))
				}
				slot = uint256(keccak256(abi.encodePacked(u, slot)));
			} else if (op == 2) {
				bytes memory v = constants[i];
				if (v.length != 32) revert InvalidConstant(v);
				slot += uint256(bytes32(v)); //v.length < 32 ? uint256(bytes32(v) >> (32 - v.length)) : uint256(bytes32(v));
			} else {
				revert InvalidOp(op);
			}
		}
	}

}
