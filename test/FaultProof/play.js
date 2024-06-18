import {ethers} from 'ethers';
import {create_provider} from './providers.js';

let provider1 = create_provider(1);

let DisputeGameFactory = new ethers.Contract('0xe5965Ab5962eDc7477C8520243A95517CD252fA9', [
	'function gameAtIndex(uint256 _index) external view returns (uint32 type, uint64 created, address proxy)',
	'function gameCount() external view returns (uint256 gameCount_)',
	'function findLatestGames(uint32 _gameType, uint256 _start, uint256 _n) external view returns (tuple(uint256 index, bytes32 metadata, uint64 timestamp, bytes32 rootClaim, bytes extraData)[] memory games_)',
], provider1);

let count = await DisputeGameFactory.gameCount();
console.log(count);

let games = await DisputeGameFactory.findLatestGames(0, count - 1n, count);
console.log(games.length);
console.log(games.slice(0, 10));

let {type, created, proxy} = await DisputeGameFactory.gameAtIndex(count - 1n);

console.log({type, created, proxy});

let FaultDisputeGame = new ethers.Contract(proxy, [
	'function l2BlockNumber() external view returns (uint256)'
], provider1);

let block = await FaultDisputeGame.l2BlockNumber();

console.log(block);

