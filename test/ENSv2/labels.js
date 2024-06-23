import {ethers} from 'ethers';

let name = 'sub.raffy.eth';

name.split('.').forEach((_, i, v) => {
	console.log(i, v.slice(i).join('.'))
});