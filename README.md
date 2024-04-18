# ens-gateway

### Server

1. `npm i`
1. `node test/TeamNick/server.js`
	* edit: port, provider1, provider2

### Contracts

1. `foundryup`
1. `npm i`
1. `node test/TeamNick/resolver2-baseless-owned.js`

Deploy [OwnedOPVerifier.sol](./contracts/evm-verifier2/OwnedOPVerifier.sol)
```bash
forge create \
  --rpc-url https://cloudflare-eth.com \
  --constructor-args 0x56315b90c40730925ec5485cf004d835058518A0 [$HTTP_ENDPOINT] 1 \
  --interactive
  contracts/evm-verifier2/OwnedOPVerifier.sol:OwnedOPVerifier

forge verify-contract \
  --constructor-args $ABI_ENCODED_ARGS \
  --verifier etherscan \
  --etherscan-api-key $ETHERSCAN_KEY \
  $VERIFIER_ADDRESS \
  contracts/evm-verifier2/OwnedOPVerifier.sol:OwnedOPVerifier
```

Deploy [TeamNick2Baseless.sol](./contracts/TeamNick2Baseless.sol)
```bash
forge create \
  --rpc-url https://cloudflare-eth.com \
  --constructor-args $VERIFIER_ADDRESS \
  --interactive
  contracts/TeamNick2Baseless.sol:TeamNick2Baseless
```

* `$HTTP_ENDPOINT` = https://home.antistupid.com/base-evm-gateway/
* `$ETHERSCAN_KEY` = ABCD...
* `$VERIFIER_ADDRESS` = 0x...
* `$ABI_ENCODED_ARGS` = get from etherscan verify contract page, or:
	* [Deployment of 0x57c189b72a193122035d9024893e50b0bf763f64](https://sepolia.etherscan.io/tx/0xd7d5cad3f36200f882a178e58faf9c70186903743029786eaff9374f1016a254)
	* Find "Input Data"
	* Find "170033" near end, eg. `...0008[170033]0000...`
	* $ABI_ENCODED_ARGS = `0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000056315b90c40730925ec5485cf004d835058518a0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002d68747470733a2f2f686f6d652e616e74697374757069642e636f6d2f626173652d65766d2d676174657761792f00000000000000000000000000000000000000`


