// src/zkExample.ts
import { nagaDev } from "@lit-protocol/networks";
import { createLitClient } from "@lit-protocol/lit-client";
import { createAuthManager, storagePlugins } from "@lit-protocol/auth";
import {
	Account,
	Address,
	createPublicClient,
	createWalletClient,
	Hex,
	http,
} from "viem";
import { baseSepolia } from "viem/chains";
import { encryptWithZkCondition } from "./encrypt.js";
import { decrypt } from "./decrypt.js";
import { createRequire } from "module";
import { uploadToPinata } from "./uploadToIpfs.js";
import { ZKGate } from "./interface/zkGate.js";
import { hashPassword, poseidon1Hash } from "./interface/utils.js";
import { buildCircuitInputs, computeTagCommitment } from "./interface/proof.js";
import {
	buildTreeFromLeaves,
	fieldToHex,
	hexToField,
} from "./interface/merkle.js";
import { VaultEntry, VaultManifest } from "./interface/types.js";

const require = createRequire(import.meta.url);
const circuit = require("../circuits/preimage/target/preimage.json");

export const runZkExample = async ({
	delegatorAccount,
	delegateeAccount,
	verifierContractAddress,
	zkGateAddress,
	ipfsCid,
}: {
	delegatorAccount: Account;
	delegateeAccount: Account;
	verifierContractAddress: string;
	zkGateAddress: string;
	ipfsCid: string;
}) => {
	const rpcUrl = process.env.CHAIN_RPC_URL;
	if (!rpcUrl) throw new Error("CHAIN_RPC_URL required");

	console.log("\n========== STARTING ZK TEST ==========\n");

	const litClient = await createLitClient({
		// @ts-expect-error - TODO: fix this
		network: nagaDev,
	});

	// ============== DELEGATOR SETUP ==============

	const delegatorPublicClient = createPublicClient({ transport: http(rpcUrl) });
	const delegatorWalletClient = createWalletClient({
		account: delegatorAccount,
		transport: http(rpcUrl),
		chain: baseSepolia,
	});

	let zkGateClient = new ZKGate(
		zkGateAddress as Address,
		delegatorPublicClient,
		delegatorWalletClient,
	);

	// ============== CONFIG ==============

	const password = "test2";
	const tag = "test-document";
	const plaintext = "This is my secret message";
	const hashPass = hashPassword(password);

	// ============== 1. CREATE VAULT ==============

	console.log("1. Creating vault...");
	const fee = await zkGateClient.getVaultCreationFee();
	const { hash: createHash, vaultId } = await zkGateClient.createVault(
		hashPass,
		fee,
	);
	await zkGateClient.waitForTransaction(createHash);
	console.log("✓ Vault created:", vaultId);

	// ============== 2. COMPUTE TAG COMMITMENT ==============

	console.log("\n2. Computing tag commitment...");
	const { leaf } = await computeTagCommitment(vaultId, tag);
	const cidCommitment = await poseidon1Hash(leaf);
	const cidCommitmentHex = fieldToHex(cidCommitment);
	console.log("✓ Leaf:", leaf.toString());
	console.log("✓ CID Commitment:", cidCommitmentHex);

	// ============== 3. ENCRYPT DATA ==============

	console.log("\n3. Encrypting data...");
	console.log("\n3. Encrypting data...");
	const { encryptedData, acc } = await encryptWithZkCondition(
		litClient,
		plaintext,
		zkGateAddress,
		vaultId,
		cidCommitmentHex,
		ipfsCid,
	);

	// Upload encrypted data
	const cid = await uploadToPinata(tag, { encryptedData, acc });
	console.log("✓ Uploaded ciphertext CID:", cid);

	// ============== 4. BUILD MERKLE TREE ==============

	console.log("\n4. Building Merkle tree...");

	// Build tree from leaves (as bigints)
	const leaves = [leaf];
	const { root, layers } = await buildTreeFromLeaves(leaves);
	console.log("✓ Merkle root:", fieldToHex(root));

	// ============== 5. CREATE & UPLOAD MANIFEST ==============

	console.log("\n5. Creating manifest...");

	// Create manifest with string values
	const manifest: VaultManifest = {
		version: 1,
		poseidon_root: fieldToHex(root),
		entries: [
			{
				tag,
				cid,
				index: 0,
				commitment: cidCommitmentHex,
				leaf: fieldToHex(leaf),
			},
		],
		tree: layers.map((layer) => layer.map(fieldToHex)),
	};

	// Rate limit protection
	await new Promise((f) => setTimeout(f, 2000));

	const manifestCid = await uploadToPinata("manifest", manifest);
	console.log("✓ Manifest CID:", manifestCid);

	// ============== 6. UPDATE VAULT ON-CHAIN ==============

	console.log("\n6. Updating vault on-chain...");
	const updateHash = await zkGateClient.updateVault(
		vaultId,
		fieldToHex(root),
		manifestCid,
	);
	await zkGateClient.waitForTransaction(updateHash);
	console.log("✓ Vault updated");

	console.log("\n========== ENCRYPTION COMPLETE ==========\n");

	// Rate limit protection
	await new Promise((f) => setTimeout(f, 3000));

	console.log("\n========== STARTING DECRYPTION ==========\n");

	// ============== 7. DELEGATEE SETUP ==============

	const authManager = createAuthManager({
		storage: storagePlugins.localStorageNode({
			appName: "fangorn",
			networkName: nagaDev.getNetworkName(),
			storagePath: "./lit-auth-storage",
		}),
	});

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

	const delegateePublicClient = createPublicClient({ transport: http(rpcUrl) });
	const delegateeWalletClient = createWalletClient({
		account: delegateeAccount,
		transport: http(rpcUrl),
		chain: baseSepolia,
	});

	zkGateClient = new ZKGate(
		zkGateAddress as Address,
		delegateePublicClient,
		delegateeWalletClient,
	);

	const userAddress = delegateeWalletClient.account.address;

	// ============== 8. BUILD CIRCUIT INPUTS ==============

	console.log("7. Building circuit inputs...");

	// Use the manifest entry (strings)
	const entry: VaultEntry = manifest.entries[0];

	const {
		inputs,
		nullifier,
		cidCommitment: computedCommitment,
	} = await buildCircuitInputs(password, entry, userAddress, vaultId, manifest);

	console.log("✓ Circuit inputs built");
	console.log("✓ Nullifier:", nullifier);
	console.log("✓ CID Commitment:", computedCommitment);

	// ============== 9. DECRYPT ==============

	console.log("\n8. Generating proof and decrypting...");

	const result = await decrypt({
		publicClient: delegateePublicClient,
		walletClient: delegateeWalletClient,
		litClient,
		ipfsCid: "",
		cidCommitment: computedCommitment,
		zkGate: zkGateClient,
		vaultId,
		nullifier,
		circuit,
		privateInputs: inputs,
		ciphertext: encryptedData,
		accessControlConditions: acc,
		authContext,
	});

	console.log("\n========== TEST PASSED ==========");
	console.log("✓ Decrypted:", result.decryptedData);

	return result;
};
