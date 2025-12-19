// import { createAccBuilder } from "@lit-protocol/access-control-conditions";
// import { acala } from "viem/chains";

// export const encryptWithZkCondition = async ({
//     litClient,
//     dataToEncrypt,
//     verifierContractAddress,
//     proofHex,
//     ipfsCid,
// }: {
//     litClient: any;
//     dataToEncrypt: string;
//     proofHex: string;
//     verifierContractAddress: string;
//     ipfsCid: string;  // Lit Action that does verification
// }) => {
//     // Build access control conditions using the uploaded Lit Action
//     // Pass contract address and required balance to the Lit Action
//     const acc = createAccBuilder()
//         .requireLitAction(ipfsCid, "go", [verifierContractAddress, proofHex], "true")
//         .build();

//     // delegatorAccount encrypts data (no AuthContext needed)
//     const encryptedData = await litClient.encrypt({
//         dataToEncrypt,
//         unifiedAccessControlConditions: acc,
//         chain: "baseSepolia",
//     });

//     return {
//         encryptedData,
//         acc,
//     };
// };