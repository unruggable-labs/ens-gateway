import {ethers} from 'ethers';

let provider1 = new ethers.InfuraProvider();
let provider2 = new ethers.JsonRpcProvider('https://rpc.scroll.io/', 534352);

let block = await provider2.getBlock(6744000);
let block_hex = ethers.toBeHex(block.number);

console.log({
	block: block_hex,
	stateRoot: block.stateRoot
});

const address = '0x09D2233D3d109683ea95Da4546e7E9Fc17a6dfAF';
const slot_hex = ethers.toBeHex(69, 32);
const slot_wtf = ethers.toBeHex(9, 32); // huh?
// guessed because: storageProof[0].proof[3]
// ...454d01010000746f6d6973636f6f6c000000000000...
//                [-looks like hex-]
//                   "tomiscool"

// get proof for slot
let proof = await provider2.send('eth_getProof', [address, [slot_hex], block_hex]);
let {accountProof, storageHash, storageProof: [storageProof]} = proof;
console.log({address, slot_hex, slot_hex2: slot_wtf, storageHash, accountProof, storageProof});

function compressProof(account, storage) {
	return ethers.concat([
		ethers.toBeHex(account.length, 1), ...account,
		ethers.toBeHex(storage.length, 1), ...storage,
	]);
}

// ScrollChainCommitmentVerifier on mainnet
let ccv = new ethers.Contract('0xc4362457a91b2e55934bdcb7daaf6b1ab3ddf203', [
	'function verifyZkTrieProof(address account, bytes32 storageKey, bytes calldata proof) external view returns (bytes32 stateRoot, bytes32 storageValue)'
], provider1);

// proof fails to verify
try {
	console.log(await ccv.verifyZkTrieProof(address, slot_hex, compressProof(accountProof, storageProof.proof)));
} catch (err) {
	console.log(err.shortMessage);
}

// verifies with different key
console.log(await ccv.verifyZkTrieProof(address, slot_wtf, compressProof(accountProof, storageProof.proof)));

/*
{
  block: '0x66e7c0',
  stateRoot: '0x02c749dc888c3b051df95574f0b654853891e5af0bc319fdcd3dea74f3da5951'
}

{
  address: '0x09D2233D3d109683ea95Da4546e7E9Fc17a6dfAF',
  slot_hex: '0x0000000000000000000000000000000000000000000000000000000000000045',
  slot_hex2: '0x0000000000000000000000000000000000000000000000000000000000000009',
  storageHash: '0x0162d19f19a165cd4def47f91da1705972ac30b8a03c6841020103c673bd73d1',
  accountProof: [
    '0x091752df4cdbe0f86b678807815de4e48947d2457c5c0c7a4bfacee8e64881857a2b1e1676691f6f635520eb60abc23be01356ca87d9c6cf4db33f11958e87ab8e',
    '0x091c24f1fb8cc5efb1bd90df11d83348222c94a712c432ddc44ddd8c95789315ff1b74fced75a5e081168d5d3c71c247b778560dfb83ed3c42f5ce6e57520fd133',
    '0x092308778442bf68462d40d198318350ae33b191b2a720f3a131e06f0e75d2eb1c020f4e8e5a96717310289912f49f7eefad416508ac4febf3209e3d017cb0adaa',
    '0x0928851ed72494727fd4e97f3aa6815968161c266a8187f6369ff8927d260dd9f52cc62a03a14366f24e3c2dde168ebf5949c46380e7c85cb7b1e41853e6e8746c',
    '0x09013337a67aa8b8f17e14481fca9a1159e187839a26fb5f1b8e49ef68931ddfaf03b09c3f9954acee07a2bd86169c3b109e633a61a070a49ca410af4b21174e67',
    '0x09198e55ed4dac0ea4c281826ef6bc6b43ff2151c7bb85d898cda40f86668dfe52251522e302cc1248b1c4ea1df0403be252720dbedda86e3706fb4113172b9cf2',
    '0x09149c0fae14c1f39d33ea46f4493810d1d8936c67757359fca6a6ba8e70180af71d05dc14adbafd6cb29bb7faeb1e6ea80fcf2dd25d40ad0f25c044dcb2eecda9',
    '0x0917013cc63337f03895e5254cc136ed42da74736bdf879c3c08262132d8a4c9610baa194077e18d061f1acf36b4f697a4bb84c4acf5000d58b91f3d354d3f1730',
    '0x0926a7fb6fdf6c5e1d3cbaa9183a14d49066a50d111c5584530ed959a7a24fdeff1ca0b3ba4666766e43491009b2730a5cedb73eee96fb1e2682cb5115519c17f7',
    '0x090ceb36dc815d9558845b5e2883490b507458250bef7f38c2d46936e97bbcb1441c449a5f4e72ba31342e93d57c416c2e42f698845d1e27d437add4990a452899',
    '0x0927a8ddbc57b8f52090a92babc4a5e442b210cb3a25e3f48bb7bd9aeaaa2729f00d053fb962308100b856afdf1e020f950bbdc6ddd532a33422afe8162c6ee227',
    '0x0902f9afbb852ad9656f5e9046b2a04b4a8ffbb713a03d89736f23e22a5ba698e70a19bee67ad2b2a1e5c5a9a93c5e333e7a1cf8a9b508c300cae039185e4061a0',
    '0x092c60ce363f331a2e1eabfd97ef8dcb37c2df33b07c6948fb339c72d77944f06a10e109d39d3638ab75908ebb85b85afa9aefc4f3c56cf9d665b3c585051a88f5',
    '0x09232a7af7b7de31147104a75b5da00b90a615454d52fe8970ed0ffc995c833c432d68f3d4f5fa50c8034adb2875eddc16a81c166cb2f6ecba823a1ebe53ff6bbb',
    '0x0910cf6305a9fe50871fc9209fddb6d28f0828f3eb773e82b457ec2a731beb0b202e257c9f8532f441a5ca3a40884fffca6eb944bcb629e3bff01a43a2f3126328',
    '0x090ac7028d72337506fe37236ace92737cdac5a3b591376f0c05cf9aaf5b25e8a9303c79b659bb71f5260a83bd9da35e0408d198ec4e9267fe44375bc529e9277c',
    '0x0906aa2bc9c27d3e605d49ec55841f101560617b7c28cd47a3676c7578874514520a9a807b71d62a8a8e91f580bdddb6ab0c0eda5177fba719523fae6336e1916a',
    '0x092e6023ef2973ed9254f25051595d709756871d8481ed2f519656c8b422ca9e9209286e9b19153ff012f63f1251c7320374c27f29ed9a6d181b7cadf79922f069',
    '0x0914ad427249a0094ff6b77f40c4153735ae9c5a40491148c2b85a94812b1b9a18014381d756212c17af8634dafa2971d174fcee94ac21d1cde3d70e1fde765239',
    '0x0923513de6e58111c198ac498ac9d0748042e98d4d51adab74cbb2f700e4ceebf50299e3ffb23667ffa8a4f4334f365ac85f0c50cd0deece14f42e9d0fde05cb1a',
    '0x0924001e7fbfa8641d71696e434395bc6e0342524862822abaf324ddb08ed445d70a05e167a442e8dd85ac928e8c43600864be423701181aa63b8468a9e21b5f34',
    '0x0927b10e7b5026639f2b866fd4861c2c61628ecca69266e42f13ef7e1606f67da22f583d401d7715e14c7ca1fadd5eebae93ce37e72165405a3922e15692e79875',
    '0x0616bb2618007d14bfe9c8c04257b904509859058bec6f6ad9fb62b78883f9b6140a7359e39f7e0a54fdf1f89844d919eb9fad70a82877129ae7f3cfab19e3d286',
    '0x040c714f32cacd972f46c463e6fdc3689474d77574777737b5991482b18af67c5a0508000000000000000000000000000000000000000000000000003e000000000000000100000000000000000000000000000000000000000000000000000000000000000162d19f19a165cd4def47f91da1705972ac30b8a03c6841020103c673bd73d1d2ac37218cfd0691ec30f9103a9e55e0dcedb2c32932b3e3d84551a5a31fb8420398bf7579918e27d3f1176134b582b9ceaf03d54f554c524c61462666e25beb2009d2233d3d109683ea95da4546e7e9fc17a6dfaf000000000000000000000000',
    '0x5448495320495320534f4d45204d4147494320425954455320464f5220534d54206d3172525867503278704449'
  ],
  storageProof: {
    key: '0x0000000000000000000000000000000000000000000000000000000000000045',
    value: '0x0',
    proof: [
      '0x092fde2c2a796ef59ba30a9e46437b75ffaeec0499c0ce37070bdb9e287e56b0c107699d53f332af82652019561c84c524ce74b6e4387b2fb3d63514e1147f931b',
      '0x09111533f7cfcbfeee1d36518821e5b0b990dd90771a30651ec224b1fed9e79e621c7f43901e5512a6e5e81a946ea61fbb2829e3eb45e5f1a3c0c60752d82fd3c9',
      '0x062f0ca3e7b530d81f5a0638c386d01a7859919e101f1ad31c7457fe00aaa8663b22cbdc71e40fd7e7936db3f8594685abbcec6190918ac17b1d095983272599c1',
      '0x0401aed20d264c5f7e70d591ae6e6f572f3335c27683dd6fd6c511106f28de454d01010000746f6d6973636f6f6c0000000000000000000000000000000000000000000012200000000000000000000000000000000000000000000000000000000000000009',
      '0x5448495320495320534f4d45204d4147494320425954455320464f5220534d54206d3172525867503278704449'
    ]
  }
}

execution reverted: "StorageKeyMismatch"

Result(2) [
  '0x02c749dc888c3b051df95574f0b654853891e5af0bc319fdcd3dea74f3da5951',
  '0x746f6d6973636f6f6c0000000000000000000000000000000000000000000012'
]

*/