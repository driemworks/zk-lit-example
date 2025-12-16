# Naga Lit Action Decryption Example

This example demonstrates how to use the Naga Lit Action to decrypt data where the Access Control Conditions is a Lit Action that checks if the user has a sufficient ERC20 token balance on the Camp testnet.

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

1. Upload the Lit Action to IPFS
2. Deploy the ERC20 test token
3. Run the tests:
   - Should fail to decrypt when delegatee has no ERC20 balance
   - Should succeed to decrypt when delegatee has sufficient ERC20 balance

### Expected Output

```
=== Uploading Lit Action to IPFS ===

✅ Lit Action uploaded to IPFS with CID: QmNWotHrRASgk8LUE7VviT7KEtETQco3uscVG149DCAGta

Lit Action CID: QmNWotHrRASgk8LUE7VviT7KEtETQco3uscVG149DCAGta

=== Deploying ERC20 Test Token ===
Compiling TestToken contract...
Deploying TestToken from 0x9d9714b25C37DF9860151B3a4258fCf922098632...

Deployment tx: 0x863c7e3b580e117be143851ace27a41eae19ad921d9947b07af0d139bf1cdc77
Waiting for transaction receipt...

TestToken deployed to: 0xac5ec3c63b4025dcea75625151db7a60f1145313
Deployment status: success

Token deployed at: 0xac5ec3c63b4025dcea75625151db7a60f1145313

Delegatee balance: 0

Encrypted data: {
  ciphertext: 'uNc8N6TWynTJbEWp2cdDiDPInUsIYxUWneXjg9aI4vN1sO8M/niL5WiJEMtaTyGAZwuiDeky80D2l2XQjbQS9GDXk/hC6vNnmAfqXNkgS1JR+QOusyzYiJKJLEJF0GOurLvuLFUuP3d+MiymezmneZeVWlZDAvf9CjJBukJDGQPUxWoqvNlBTyIYNInhg1PsS+GbI0gxxXhOxGnByCLI/rw3Ag==',
  dataToEncryptHash: '5af9be4a552f9adba6ade8e6e29a516e3cd863c3cca9750502397ed7e1d603f7',
  metadata: { dataType: 'string' }
}

Decryption failed as expected: LitError [NodeError]: "Decryption" failed for request lit_1764982887581_vxdbu0g8wn. failed access control conditions. Details: {"errorKind":"Validation","errorCode":"NodeAccessControlConditionsReturnedNotAuthorized","status":401,"message":"The access control condition check returned that you are not permitted to access this content.  Are you sure you meet the conditions?  Check the auth_sig and the other conditions","details":["The access control condition check returned that you are not permitted to access this content.  Are you sure you meet the conditions?  Check the auth_sig and the other conditions"]}: failed access control conditions
    at Object.handleEncryptedError (node_modules/.pnpm/@lit-protocol+networks@8.3.2_patch_hash=621124717335d991e636f1c1035247fecc860128597400b_b0f3e2c85c21545ed3e4d8f6c0cfb6b5/packages/networks/src/networks/vNaga/shared/managers/api-manager/e2ee-request-manager/E2EERequestManager.ts:235:15)
    at Object.handleResponse (node_modules/.pnpm/@lit-protocol+networks@8.3.2_patch_hash=621124717335d991e636f1c1035247fecc860128597400b_b0f3e2c85c21545ed3e4d8f6c0cfb6b5/packages/networks/src/networks/vNaga/shared/factories/BaseModuleFactory.ts:809:32)
    ... 4 lines matching cause stack trace ...
    at file://node_modules/.pnpm/@vitest+runner@4.0.15/node_modules/@vitest/runner/dist/index.js:915:20 {
  shortMessage: '"Decryption" failed for request lit_1764982887581_vxdbu0g8wn. failed access control conditions. Details: {"errorKind":"Validation","errorCode":"NodeAccessControlConditionsReturnedNotAuthorized","status":401,"message":"The access control condition check returned that you are not permitted to access this content.  Are you sure you meet the conditions?  Check the auth_sig and the other conditions","details":["The access control condition check returned that you are not permitted to access this content.  Are you sure you meet the conditions?  Check the auth_sig and the other conditions"]}',
  cause: Error: failed access control conditions
      at Object.handleEncryptedError (node_modules/.pnpm/@lit-protocol+networks@8.3.2_patch_hash=621124717335d991e636f1c1035247fecc860128597400b_b0f3e2c85c21545ed3e4d8f6c0cfb6b5/packages/networks/src/networks/vNaga/shared/managers/api-manager/e2ee-request-manager/E2EERequestManager.ts:231:15)
      at Object.handleResponse (node_modules/.pnpm/@lit-protocol+networks@8.3.2_patch_hash=621124717335d991e636f1c1035247fecc860128597400b_b0f3e2c85c21545ed3e4d8f6c0cfb6b5/packages/networks/src/networks/vNaga/shared/factories/BaseModuleFactory.ts:809:32)
      at Object._decrypt [as decrypt] (node_modules/.pnpm/@lit-protocol+lit-client@8.2.3_typescript@5.9.3_viem@2.41.2_typescript@5.9.3_zod@3.24.3_/packages/lit-client/src/lib/LitClient/createLitClient.ts:807:59)
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
      at runExample (src/example.ts:55:29)
  info: {
    operationName: 'Decryption',
    requestId: 'lit_1764982887581_vxdbu0g8wn',
    rawNodeError: {
      ok: false,
      error: 'failed access control conditions',
      errorObject: '{"errorKind":"Validation","errorCode":"NodeAccessControlConditionsReturnedNotAuthorized","status":401,"message":"The access control condition check returned that you are not permitted to access this content.  Are you sure you meet the conditions?  Check the auth_sig and the other conditions","details":["The access control condition check returned that you are not permitted to access this content.  Are you sure you meet the conditions?  Check the auth_sig and the other conditions"]}',
      data: null
    }
  },
  code: 'node_error',
  kind: 'Unknown'
}

Minting 10 tokens to 0x1cFe66dcD5879985210302663D3C537Fe11497D0...

Mint tx: 0x2b60409d78dbe5b5a5b114fc3b1cfb4929a600fc0b842faf16a4845dc0fa7447

Mint tx status: success
Mint tx block number: 25707658
Waiting for additional block confirmations...

Confirmed at block 25707660
Minted 10 tokens successfully

Delegatee balance after mint: 10000000000000000000

Encrypted data: {
  ciphertext: 'gq68MsCCLw5izXBIMCAo7CaespdEsK1kLo60uzasT3G3VdIwZXIHb+J7Nrbb7QktIQwYWyFMrKUAf4Sv9lLro9stdsBQKRBr3f2G0jVy4UhRJOiMT32PUkC2OTE1wpusc6jdBElFTfqDEe4Go7QpgJ8t6My3TXhDGON8Zh9yKV1BNcL78Q0tf3V1uLIVYSqocK+bGqAMazve1ENH9v0Lx3orAg==',
  dataToEncryptHash: '5af9be4a552f9adba6ade8e6e29a516e3cd863c3cca9750502397ed7e1d603f7',
  metadata: { dataType: 'string' }
}

Decrypted response: {
  decryptedData: Uint8Array(80) [
     84, 104, 101,  32,  97, 110, 115, 119, 101, 114,  32, 116,
    111,  32, 116, 104, 101,  32, 117, 108, 116, 105, 109,  97,
    116, 101,  32, 113, 117, 101, 115, 116, 105, 111, 110,  32,
    111, 102,  32, 108, 105, 102, 101,  44,  32, 116, 104, 101,
     32, 117, 110, 105, 118, 101, 114, 115, 101,  44,  32,  97,
    110, 100,  32, 101, 118, 101, 114, 121, 116, 104, 105, 110,
    103,  32, 105, 115,  32,  52,  50,  46
  ],
  metadata: { dataType: 'string' },
  convertedData: 'The answer to the ultimate question of life, the universe, and everything is 42.'
}

Decryption succeeded!

 ✓ src/example.test.ts (2 tests) 29617ms
   ✓ ERC20-gated decryption (2)
     ✓ should fail to decrypt when delegatee has no ERC20 balance  4598ms
     ✓ should succeed to decrypt when delegatee has sufficient ERC20 balance  13262ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  15:01:10 
   Duration  31.87s (transform 893ms, setup 0ms, import 2.16s, tests 29.62s, environment 0ms)

```
