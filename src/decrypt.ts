// src/decrypt.ts
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { CompiledCircuit, Noir } from "@noir-lang/noir_js";
import {
	type PublicClient,
	type WalletClient,
	type Hex,
	type Address,
	toHex,
} from "viem";
import { ZKGate } from "./interface/zkGate.js";

export interface DecryptParams {
	// Clients
	publicClient: PublicClient;
	walletClient: WalletClient;
	litClient: any;
	ipfsCid: any;
	zkGate: ZKGate;

	// Vault info
	vaultId: `0x${string}`;
	nullifier: `0x${string}`;

	// Circuit
	circuit: CompiledCircuit;
	privateInputs: Record<string, any>;

	// LIT
	ciphertext: any;
	accessControlConditions: any;
	authContext: any;
}

export interface DecryptResult {
	txHash: Hex;
	txReceipt: any;
	decryptedData: any;
}

export async function decrypt(params: DecryptParams): Promise<DecryptResult> {
	const {
		publicClient,
		walletClient,
		litClient,
		ipfsCid,
		zkGate: zkgate,
		vaultId,
		nullifier,
		circuit,
		privateInputs,
		ciphertext,
		accessControlConditions,
		authContext,
	} = params;

	// 1. Generate ZK proof
	console.log("Initializing Barretenberg...");
	const api = await Barretenberg.new({ threads: 1 });
	const backend = new UltraHonkBackend(circuit.bytecode, api);
	const noir = new Noir(circuit);

	console.log("Generating witness...");
	const { witness } = await noir.execute(privateInputs);

	console.log("Generating proof...");
	const proofResult = await backend.generateProof(witness, {
		keccak: true,
	});

	const proofHex: Hex = toHex(proofResult.proof);
	console.log("Proof generated:", proofHex.slice(0, 66) + "...");

	// 2. Submit proof to ZKGate
	console.log("Submitting proof to ZKGate...");
	const txHash = await zkgate.submitProof(vaultId, nullifier, proofHex);

	console.log("Waiting for transaction confirmation...");
	const txReceipt = await zkgate.waitForTransaction(txHash);

	if (txReceipt.status !== "success") {
		throw new Error(`Transaction failed: ${txReceipt.status}`);
	}

	console.log("Transaction confirmed in block:", txReceipt.blockNumber);

	// sanity check: verify access was granted
	const account = walletClient.account;
	if (!account) throw new Error("Wallet account required");

	// sanity check
	const hasAccess = await zkgate.checkAccess(vaultId, account.address);
	if (!hasAccess) {
		throw new Error("Access not granted after proof submission");
	}

	// try to decrypt
	console.log("Requesting decryption from LIT...");
	// const decryptedResponse = await litClient.decrypt({
	// 	ciphertext: ciphertext.ciphertext,
	// 	dataToEncryptHash: ciphertext.dataToEncryptHash,
	// 	unifiedAccessControlConditions: accessControlConditions,
	// 	authContext,
	// 	chain: "baseSepolia",
	// });

	// console.log("Decryption successful");

	const result = await litClient.executeJs({
		ipfsId: "CID_OF_YOUR_GUARD_CODE",
		authContext,
		jsParams: {
			ciphertext: ciphertext.ciphertext,
			dataToEncryptHash: ciphertext.dataToEncryptHash,
			acc,
			requestedCid,
		},
	});
	console.log(result.response); // This is your plaintext

	return {
		txHash,
		txReceipt,
		decryptedData: "",
	};
}

// Convenience function for just generating the proof without submitting
export async function generateProof(
	circuit: CompiledCircuit,
	privateInputs: Record<string, any>,
): Promise<{ proof: Hex; publicInputs: string[] }> {
	const api = await Barretenberg.new({ threads: 1 });
	const backend = new UltraHonkBackend(circuit.bytecode, api);
	const noir = new Noir(circuit);

	const { witness } = await noir.execute(privateInputs);
	const proofResult = await backend.generateProof(witness, {
		keccak: true,
	});

	return {
		proof: toHex(proofResult.proof),
		publicInputs: proofResult.publicInputs,
	};
}
