import { nagaDev } from "@lit-protocol/networks";
import { createLitClient } from "@lit-protocol/lit-client";
import { createAuthManager, storagePlugins } from "@lit-protocol/auth";
import {
	Account,
	Address,
	createPublicClient,
	createWalletClient,
	encodeFunctionData,
	Hex,
	http,
} from "viem";
import { createAccBuilder } from "@lit-protocol/access-control-conditions";
import { baseSepolia, foundry, lineaSepolia, sepolia } from "viem/chains";
import { encryptWithZkCondition } from "./encrypt.js";
import { decrypt } from "./decrypt.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// dummy x + y = 3 circuit
const circuit = require("../circuits/sum3-circuit/target/circuit.json");

export const runZkExample = async ({
	delegatorAccount,
	delegateeAccount,
	verifierContractAddress,
	zkGateAddress,
	proofHex,
	// publicInputs,
	ipfsCid,
}: {
	delegatorAccount: Account;
	delegateeAccount: Account;
	verifierContractAddress: string;
	zkGateAddress: string;
	proofHex: string;
	// publicInputs: string;
	ipfsCid: string;
}) => {
	const litClient = await createLitClient({
		// @ts-expect-error - TODO: fix this
		network: nagaDev,
	});

	let plaintext = "This is my message";
	let { encryptedData, acc } = await encryptWithZkCondition(
		litClient,
		plaintext,
		verifierContractAddress,
		zkGateAddress,
		ipfsCid,
	);
	console.log("Encrypted data:", encryptedData);

	const authManager = createAuthManager({
		storage: storagePlugins.localStorageNode({
			appName: "fangorn",
			networkName: nagaDev.getNetworkName(),
			storagePath: "./lit-auth-storage",
		}),
	});

	// delegateeAccount needs AuthContext for decryption
	const authContext = await authManager.createEoaAuthContext({
		litClient,
		config: {
			account: delegateeAccount,
		},
		authConfig: {
			domain: "localhost",
			statement: "Decrypt test data",
			expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
			resources: [
				["access-control-condition-decryption", "*"],
				["lit-action-execution", "*"],
			],
		},
	});

	// submit proof on-chain
	// === SUBMIT PROOF ON-CHAIN (delegatee) ===
	const rpcUrl = process.env.CHAIN_RPC_URL;
	if (!rpcUrl) throw new Error("CHAIN_RPC_URL required");

	const publicClient = createPublicClient({ transport: http(rpcUrl) });

	const walletClient = createWalletClient({
		account: delegateeAccount,
		transport: http(rpcUrl),
	});

	const zkGateAbi = [
		{
			name: "submitAndVerify",
			type: "function",
			stateMutability: "nonpayable",
			inputs: [
				{ name: "verifier", type: "address" },
				{ name: "proof", type: "bytes" },
				{ name: "publicInputs", type: "bytes32[]" },
			],
			outputs: [{ type: "bool" }],
		},
		{
			name: "checkAccess",
			type: "function",
			stateMutability: "view",
			inputs: [
				{ name: "user", type: "address" },
				{ name: "verifier", type: "address" },
			],
			outputs: [{ type: "bool" }],
		},
	] as const;

	const inputs = { x: "1", y: "2" };
	let decryptedContent = await decrypt(
		publicClient,
		walletClient,
		litClient,
		authContext,
		encryptedData,
		acc,
		circuit,
		inputs,
		zkGateAddress as Hex,
		verifierContractAddress as Hex,
		zkGateAbi,
	);

	// console.log("Submitting proof to ZKGate...");

	// const gasPrice = await publicClient.getGasPrice();

	// // --------------------------
	// // make the actual call
	// const gas = await publicClient.estimateContractGas({
	// 	address: zkGateAddress as Hex,
	// 	abi: zkGateAbi,
	// 	functionName: "submitAndVerify",
	// 	args: [
	// 		verifierContractAddress as Address,
	// 		proofHex as Hex,
	// 		[] as `0x${string}`[],
	// 	],
	// 	account: walletClient.account,
	// });

	// console.log("Estimated gas:", gas);
	// const hash = await walletClient.writeContract({
	// 	address: zkGateAddress as Hex,
	// 	abi: zkGateAbi,
	// 	functionName: "submitAndVerify",
	// 	args: [
	// 		verifierContractAddress as Address,
	// 		proofHex as Hex,
	// 		[] as `0x${string}`[],
	// 	],
	// 	chain: baseSepolia,
	// 	gas: gas + gas / 10n, // 10% buffer
	// 	gasPrice: gasPrice * 2n,
	// });

	// // // sanity check
	// // // Right after transaction succeeds
	// const txReceipt = await publicClient.waitForTransactionReceipt({ hash });
	// console.log("Transaction confirmed in block:", txReceipt.blockNumber);
	// console.log("Transaction status:", txReceipt.status);

	// const decryptedContent = await litClient.decrypt({
	// 	...encryptedData,
	// 	unifiedAccessControlConditions: acc,
	// 	authContext: authContext,
	// });

	console.log("Decrypted:", decryptedContent);
};
