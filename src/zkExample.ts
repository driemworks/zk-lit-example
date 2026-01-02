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
import { downloadFromPinata, uploadToPinata } from "./uploadToIpfs.js";
import { ZKGate } from "./interface/zkGate.js";
import {
	addressToBytes32Array,
	computeNullifier,
	hashPassword,
	hexToBytes32Array,
	stringToBytes32Array,
} from "./interface/utils.js";
import { StorageProvider } from "./interface/types.js";

const require = createRequire(import.meta.url);

// dummy x + y = 3 circuit
const circuit = require("../circuits/preimage/target/preimage.json");

export const runZkExample = async ({
	delegatorAccount,
	delegateeAccount,
	verifierContractAddress,
	zkGateAddress,
	// proofHex,
	// publicInputs,
	ipfsCid,
}: {
	delegatorAccount: Account;
	delegateeAccount: Account;
	verifierContractAddress: string;
	zkGateAddress: string;
	// proofHex: string;
	// publicInputs: string;
	ipfsCid: string;
}) => {
	const rpcUrl = process.env.CHAIN_RPC_URL;
	if (!rpcUrl) throw new Error("CHAIN_RPC_URL required");

	const litClient = await createLitClient({
		// @ts-expect-error - TODO: fix this
		network: nagaDev,
	});

	// START ENCRYPTION FLOW
	// create the vault
	const doCreateVault = true;

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
	const password = "password";
	const hashPass = hashPassword(password);
	let vaultId =
		"0x267f2dbc9ba7e67fadf7aa2fab672b8d006147d40acdc9450e045d0176baf415" as Hex;

	if (doCreateVault) {
		const fee = await zkGateClient.getVaultCreationFee();
		const { hash, vaultId } = await zkGateClient.createVault(hashPass, fee);
		console.log("created vault with id " + vaultId);
		await zkGateClient.waitForTransaction(hash);

		console.log("created vault with id " + vaultId);

		let plaintext = "This is my message";
		const { encryptedData, acc } = await encryptWithZkCondition(
			litClient,
			plaintext,
			zkGateAddress,
			vaultId,
			ipfsCid,
		);
		const cid = await uploadToPinata("ciphertext", { encryptedData, acc });

		console.log("ciphertext cid = " + cid);

		// add cid to vault
		const addEntryHash = await zkGateClient.addEntry(
			vaultId,
			cid,
			"test",
			StorageProvider.Pinata,
		);
		await zkGateClient.waitForTransaction(addEntryHash);

		// sanity check
		const entries = await zkGateClient.getAllEntries(vaultId);
		console.log(
			"entries:",
			JSON.stringify(entries, (key, value) =>
				typeof value === "bigint" ? value.toString() : value,
			),
		);
	}
	// add the ciphertext to IPFS

	// END ENCRYPTION FLOW
	// ---------------------------------------------------------------------------------
	// ---------------------------------------------------------------------------------
	// START DECRYPTION FLOW
	// build auth context
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

	const storedHash = await zkGateClient.getVaultPasswordHash(vaultId);
	console.log("storedHash:", storedHash);
	console.log("hashPass:", hashPass as Hex);
	console.log("Match:", storedHash.toLowerCase() === hashPass.toLowerCase());

	// fetch encryptedData from IPFS based on (vaultId, tag)
	// this will just look at the first item in the vault
	const entries = await zkGateClient.getAllEntries(vaultId);
	const cidToFetch = entries[0].cid;
	const { encryptedData, acc } = await downloadFromPinata(cidToFetch);
	console.log("got data: " + JSON.stringify(encryptedData));
	console.log("got acc: " + acc);

	const userAddress = delegateeWalletClient.account.address;
	const nullifier = computeNullifier(password, userAddress, vaultId);

	const privateInputs = {
		password: stringToBytes32Array(password),
		expected_hash: hexToBytes32Array(hashPass),
		user_address: addressToBytes32Array(userAddress),
		vault_id: hexToBytes32Array(vaultId),
		nullifier: hexToBytes32Array(nullifier),
	};

	const result = await decrypt({
		publicClient: delegateePublicClient,
		walletClient: delegateeWalletClient,
		litClient,
		zkGate: zkGateClient,
		vaultId,
		nullifier: nullifier,
		circuit,
		privateInputs,
		ciphertext: encryptedData,
		accessControlConditions: acc,
		authContext,
	});

	console.log("Decrypted:", result.decryptedData);
};
