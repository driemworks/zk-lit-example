# Privacy-Preserving Lit Action Decryption Example

This example demonstrates how to use the Naga Lit Action to decrypt data where the Access Control Conditions is a Lit Action that checks if the user has a valid zero-knowledge proof (on the Base Sepolia testnet).

## Setup

1. `cp .env.example .env`
2. Fill in the ENVs:
   - `DELEGATOR_ETH_PRIVATE_KEY`: The private key of the delegator account
     - Needs to have a balance of test CAMP to send transactions
   - `DELEGATEE_ETH_PRIVATE_KEY`: The private key of the delegatee account
     - Doesn't need to have a balance of test CAMP, used to sign the Lit Auth Sig for the decryption request
   - `ERC20_CHAIN_RPC_URL`: The RPC URL of the ERC20 chain
     - Expected to be Camp testnet: https://rpc.basecamp.t.raas.gelato.cloud
   - `PINATA_JWT`: The JWT for Pinata
     - Can be obtained from: https://app.pinata.cloud/developers/api-keys
3. `pnpm i`

## Running the tests

`pnpm test`

The tests will:

1. Build and deploy the solidity verifier to base sepolia
2. Upload the Lit Action to IPFS
3. Run the tests:
   - Should fail to decrypt when delegatee provides invalid proof data
   - Should succeed to decrypt when delegatee has a valid proof
