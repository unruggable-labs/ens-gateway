# ens-gateway

### Server

1. `npm i`
1. `node test/TeamNick/server.js`
	* edit: port, provider1, provider2

### Contract

1. `foundryup`
1. `npm i`
1. `node test/TeamNick/resolver2combo.js`
	* 3.8m gas &rarr; 100$ at 10gwei

```
forge create \
  --rpc-url https://cloudflare.eth \
  --constructor-args [$HTTP_ENDPOINT] 0x56315b90c40730925ec5485cf004d835058518A0 1 \
  --private-key $PRIVATE_KEY \
  contracts/TeamNick2WithVerifier.sol:TeamNick2WithVerifier

forge verify-contract \
  --constructor-args $ABI_ENCODED_ARGS \
  --verifier etherscan \
  --etherscan-api-key $ETHERSCAN_KEY \
  $DEPLOYMENT_ADDRESS \
  contracts/TeamNick2WithVerifier.sol:TeamNick2WithVerifier

$HTTP_ENDPOINT = https://home.antistupid.com/base-evm-gateway/
$PRIVATE_KEY = 0x...
$ABI_ENCODED_ARGS = 0x... (get this from etherscan verify page)
$ETHERSCAN_KEY = ABCD...
$DEPLOYMENT_ADDRESS = 0x...
```