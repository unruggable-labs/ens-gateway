import {Foundry} from '@adraffy/blocksmith';
import {ethers} from 'ethers';

let foundry = await Foundry.launch();

await foundry.deploy({file: 'TeamNick', args: [ethers.ZeroAddress]});
await foundry.deploy({file: 'TeamNick2', args: [ethers.ZeroAddress]});
await foundry.deploy({file: 'TeamNick2WithVerifier', args: [[], ethers.ZeroAddress, 0]});
await foundry.deploy({file: 'TeamNick2Baseless', args: [ethers.ZeroAddress, ethers.ZeroAddress]});
await foundry.deploy({file: 'TeamNick2BaselessNoOZ', args: [ethers.ZeroAddress, ethers.ZeroAddress]});
await foundry.deploy({sol: `
	import {ENS} from "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
	import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
	import {IExtendedResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";
	import {BytesUtils} from "@ensdomains/ens-contracts/contracts/wrapper/BytesUtils.sol";
	contract ResolverWithFindSelf is IERC165, IExtendedResolver {
		using BytesUtils for bytes;
		error Unreachable(bytes name);
		ENS immutable ens;
		constructor(ENS _ens) {
			ens = _ens;
		}
		function supportsInterface(bytes4 x) external pure returns (bool) {
			return x == type(IERC165).interfaceId || x == type(IExtendedResolver).interfaceId;
		}
		function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
			uint256 offset = _findSelf(name);
			return '';
		}
		function _findSelf(bytes memory name) internal view returns (uint256 offset) {
			unchecked {
				while (true) {
					bytes32 node = name.namehash(offset);
					if (ens.resolver(node) == address(this)) break;
					uint256 size = uint8(name[offset]);
					if (size == 0) revert Unreachable(name);
					offset += 1 + size;
				}
			}
		}
	}
`, args: [ethers.ZeroAddress]});

foundry.shutdown();
