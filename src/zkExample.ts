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

// const _litActionCode = async () => {
//     try {
//         // Decrypt the content using decryptAndCombine
//         const decryptedContent = await LitActions.decryptAndCombine({
//             accessControlConditions: jsParams.accessControlConditions,
//             ciphertext: jsParams.ciphertext,
//             dataToEncryptHash: jsParams.dataToEncryptHash,
//             // The authenticated identity from the authContext used
//             // to make the decryption request is automatically used
//             // for the decryption request
//             authSig: null,
//             chain: 'ethereum',
//         });

//         // Use the decrypted content for your logic
//         LitActions.setResponse({
//             response: `Successfully decrypted: ${decryptedContent}`,
//             success: true
//         });
//     } catch (error) {
//         LitActions.setResponse({
//             response: `Decryption failed: ${error.message}`,
//             success: false
//         });
//     }
// };

// const litActionCode = `(${_litActionCode.toString()})();`;

export const runZkExample = async ({
	delegatorAccount,
	delegateeAccount,
	verifierContractAddress,
	zkGateAddress,
	proofHex,
	// publicInputs,
	ipfsCid,
	// decryptIpfsCid,
}: {
	delegatorAccount: Account;
	delegateeAccount: Account;
	verifierContractAddress: string;
	zkGateAddress: string;
	proofHex: string;
	// publicInputs: string;
	ipfsCid: string;
	// decryptIpfsCid: string;
}) => {
	const litClient = await createLitClient({
		// @ts-expect-error - TODO: fix this
		network: nagaDev,
	});

	// Build access control conditions using the uploaded Lit Action
	// Pass contract address and required balance to the Lit Action
	const acc = createAccBuilder()
		.requireLitAction(
			ipfsCid,
			"go",
			[zkGateAddress, verifierContractAddress],
			"true",
		)
		.build();

	// delegatorAccount encrypts data (no AuthContext needed)
	const encryptedData = await litClient.encrypt({
		dataToEncrypt:
			"The answer to the ultimate question of life, the universe, and everything is 42.",
		unifiedAccessControlConditions: acc,
		// chain: "baseSepolia",
	});
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

	console.log("Submitting proof to ZKGate...");

	// Simulate (sanity check)
	const valid = await publicClient.simulateContract({
		address: zkGateAddress as Address,
		abi: zkGateAbi,
		functionName: "submitAndVerify",
		args: [
			verifierContractAddress as Address,
			proofHex as Hex,
			[] as `0x${string}`[],
		],
		account: delegateeAccount,
	});
	console.log("Will succeed:", valid.result);

	const callData = encodeFunctionData({
		abi: zkGateAbi,
		functionName: "submitAndVerify",
		args: [
			verifierContractAddress as Address,
			proofHex as Hex,
			[] as `0x${string}`[],
		],
	});

	const gasPrice = await publicClient.getGasPrice();
	const nonce = await publicClient.getTransactionCount({
		address: walletClient.account.address,
	});

	const zkGateResultSim = await publicClient.call({
		to: zkGateAddress as Hex,
		data: callData,
		gas: 20_000_000n,
		gasPrice: gasPrice,
		nonce,
	});

	console.log("simulated result: ", zkGateResultSim);
	console.log("Delegatee address:", delegateeAccount.address);

	// --------------------------
	// directly call the verifier contract
	const dgas = await publicClient.estimateContractGas({
		address: verifierContractAddress as Hex,
		abi: [
			{
				name: "verify",
				type: "function",
				stateMutability: "view",
				inputs: [
					{ name: "_proof", type: "bytes" },
					{ name: "_publicInputs", type: "bytes32[]" },
				],
				outputs: [{ type: "bool" }],
			},
		],
		functionName: "verify",
		args: [proofHex as Hex, [] as `0x${string}`[]],
		account: walletClient.account,
	});

	console.log("Estimated gas for verify:", dgas);

	const directHash = await walletClient.writeContract({
		address: verifierContractAddress as Hex,
		abi: [
			{
				name: "verify",
				type: "function",
				stateMutability: "view",
				inputs: [
					{ name: "_proof", type: "bytes" },
					{ name: "_publicInputs", type: "bytes32[]" },
				],
				outputs: [{ type: "bool" }],
			},
		],
		functionName: "verify",
		args: [proofHex as Hex, [] as `0x${string}`[]],
		chain: foundry,
		gas: dgas + dgas / 10n,
		gasPrice: gasPrice * 2n,
	});

	const newreceipt = await publicClient.waitForTransactionReceipt({
		hash: directHash,
	});
	console.log("Direct verify tx status:", newreceipt.status);

	// --------------------------
	// make the actual call
	const gas = await publicClient.estimateContractGas({
		address: zkGateAddress as Hex,
		abi: zkGateAbi,
		functionName: "submitAndVerify",
		args: [
			verifierContractAddress as Address,
			proofHex as Hex,
			[] as `0x${string}`[],
		],
		account: walletClient.account,
	});

	console.log("Estimated gas:", gas);
	const hash = await walletClient.writeContract({
		address: zkGateAddress as Hex,
		abi: zkGateAbi,
		functionName: "submitAndVerify",
		args: [
			verifierContractAddress as Address,
			proofHex as Hex,
			[] as `0x${string}`[],
		],
		chain: foundry,
		gas: gas + gas / 10n, // 10% buffer
		gasPrice: gasPrice * 2n,
	});

	// sanity check
	// Right after transaction succeeds
	const txReceipt = await publicClient.waitForTransactionReceipt({ hash });
	console.log("Transaction confirmed in block:", txReceipt.blockNumber);
	console.log("Transaction status:", txReceipt.status);

	// Check immediately
	const hasAccess = await publicClient.readContract({
		address: zkGateAddress as Hex,
		abi: zkGateAbi,
		functionName: "checkAccess",
		args: [delegateeAccount.address, verifierContractAddress as Address],
		blockNumber: txReceipt.blockNumber, // ← Check at the exact block
	});
	console.log("Has access (at tx block):", hasAccess);

	console.log("Has access? :", hasAccess);
	if (!hasAccess) {
		throw new Error("Proof verification failed on-chain");
	}

	// TODO: can replace with decrypt call!
	// as is, this doesn't actually decrypt anything.
	// const result = await litClient.executeJs({
	//     ipfsId: ipfsCid,
	//     authContext: authContext,
	// });

	// console.log("Decrypted response:", result);
};
