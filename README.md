# ens-gateway

### Server

1. `npm i`
1. `node test/TeamNick/server.js`
	* edit: port &rarr; 8018

### Contract

1. `foundryup`
1. `npm i`
1. `node test/TeamNick/resolver2combo.js`
	* 3.8m gas &rarr; 100$ at 10gwei

```
forge create \
  --rpc-url https://cloudflare.eth \
  --constructor-args [https://...] 0x56315b90c40730925ec5485cf004d835058518A0 1 \
  --private-key $PRIVATE_KEY \
  contracts/TeamNick2WithVerifier.sol:TeamNick2WithVerifier

forge verify-contract \
  --constructor-args $ABI_ENCODED_ARGS \
  --verifier etherscan \
  --etherscan-api-key $ETHERSCAN_KEY \
  $DEPLOYMENT_ADDRESS \
  contracts/TeamNick2WithVerifier.sol:TeamNick2WithVerifier

$ABI_ENCODED_ARGS = get this from etherscan verify page
```