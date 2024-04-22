# ens-gateway

### Setup

1. `foundryup`
1. `npm i`
1. create [`.env`](./.env.example)

## TeamNick2

### Tests

1. `node test/TeamNick2/resolver.js`
1. `node test/TeamNick2/resolver2.js` &mdash; gateway protocol v2
1. `node test/TeamNick2/resolver2-baseless-owned.js` &mdash; doesn't require hardcoded basename
1. `node test/TeamNick2/resolver2-baseless-deployed-verifier.js` &mdash; uses deployed verifier
1. `node test/TeamNick2/resolver2-baseless-deployed-complete.js` &mdash; uses deployed verifier and resolver

### Server

1. `node test/TeamNick/server2.js`

#### Deployments

* **base** &mdash; `https://home.antistupid.com/base-evm-gateway/`

### Contracts

1. Verify: `node test/TeamNick/resolver2-baseless-owned.js`
1. Deploy [**OwnedOPVerifier.sol**](./contracts/evm-verifier2/OwnedOPVerifier.sol)
	```bash
	forge create \
	--rpc-url https://cloudflare-eth.com \
	--constructor-args 0x56315b90c40730925ec5485cf004d835058518A0 [https://home.antistupid.com/base-evm-gateway] 1 \
	--etherscan-api-key 8914BPGNXPY85VPJ8I9YTMNKKXAJBC9WWM \
	--verify \
	--interactive \
	contracts/evm-verifier2/OwnedOPVerifier.sol:OwnedOPVerifier
	```
	* **base** &mdash; [L2OutputOracle](https://docs.base.org/docs/base-contracts#base-mainnet) &rarr; [`0x56315b90c40730925ec5485cf004d835058518A0`](https://etherscan.io/address/0x56315b90c40730925ec5485cf004d835058518A0)
	* **op** &mdash; [L2OutputOracle](https://docs.optimism.io/chain/addresses#ethereum-l1) &rarr; [`0xdfe97868233d1aa22e815a266982f2cf17685a27`](https://etherscan.io/address/0xdfe97868233d1aa22e815a266982f2cf17685a27)
1. Deploy [**TeamNick2Baseless.sol**](./contracts/TeamNick2Baseless.sol)
	```bash
	forge create \
	  --rpc-url https://cloudflare-eth.com \
	  --constructor-args 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e $VERIFIER_ADDRESS \
	  --etherscan-api-key 8914BPGNXPY85VPJ8I9YTMNKKXAJBC9WWM \
	  --verify \
	  --interactive \
	  contracts/TeamNick2Baseless.sol:TeamNick2Baseless
	```
#### Deployments
* **main&rarr;base** &mdash; [**OwnedOPVerifier**](./contracts/evm-verifier2/OwnedOPVerifier.sol) &rarr; [`0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d`](https://etherscan.io/address/0xEC2244b547BD782FC7DeefC6d45E0B3a3cbD488d#readContract)
* **main&rarr;base** &mdash; [**TeamNick2Baseless**](./contracts/TeamNick2Baseless.sol) &rarr; [`0x5C767340d2797b22eeDD5a4920206A5284C314b4`](https://etherscan.io/address/0x5C767340d2797b22eeDD5a4920206A5284C314b4#readContract)

## Cypher

### Tests

1. `node test/Cypher/resolver2.js`

### Server

1. `node test/Cypher/server2.js`
