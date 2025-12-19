// import { nagaDev } from "@lit-protocol/networks";
// import { createLitClient } from "@lit-protocol/lit-client";
// import { createAuthManager, storagePlugins } from "@lit-protocol/auth";
// import { Account } from "viem";
// import { createAccBuilder } from "@lit-protocol/access-control-conditions";
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);

// export const runZkExample = async ({
//     delegatorAccount,
//     delegateeAccount,
//     verifierContractAddress,
//     proofHex,
//     // publicInputs,
//     ipfsCid,
// }: {
//     delegatorAccount: Account;
//     delegateeAccount: Account;
//     verifierContractAddress: string;
//     proofHex: string;
//     // publicInputs: string;
//     ipfsCid: string;
// }) => {
//     const litClient = await createLitClient({
//         // @ts-expect-error - TODO: fix this
//         network: nagaDev,
//     });

//     // Build access control conditions using the uploaded Lit Action
//     // Pass contract address and required balance to the Lit Action
//     const litActionGated = createAccBuilder()
//         .requireLitAction(ipfsCid, "go", [verifierContractAddress, proofHex], "true")
//         .build();

//     // delegatorAccount encrypts data (no AuthContext needed)
//     const encryptedData = await litClient.encrypt({
//         dataToEncrypt:
//             "The answer to the ultimate question of life, the universe, and everything is 42.",
//         unifiedAccessControlConditions: litActionGated,
//         chain: "baseSepolia",
//     });
//     console.log("Encrypted data:", encryptedData);

//     const authManager = createAuthManager({
//         storage: storagePlugins.localStorageNode({
//             appName: "fangorn",
//             networkName: nagaDev.getNetworkName(),
//             storagePath: "./lit-auth-storage",
//         }),
//     });

//     // delegateeAccount needs AuthContext for decryption
//     const authContext = await authManager.createEoaAuthContext({
//         litClient,
//         config: {
//             account: delegateeAccount,
//         },
//         authConfig: {
//             domain: "localhost",
//             statement: "Decrypt test data",
//             expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
//             resources: [
//                 ["access-control-condition-decryption", "*"],
//                 ["lit-action-execution", "*"],
//             ],
//         },
//     });

//     // delegateeAccount decrypts data (requires AuthContext)
//     // The delegatee should use the delegated payment capacity from delegatorAccount
//     const decryptedResponse = await litClient.decrypt({
//         data: encryptedData,
//         unifiedAccessControlConditions: litActionGated,
//         authContext,
//         chain: "baseSepolia",
//     });
//     console.log("Decrypted response:", decryptedResponse);
// };
