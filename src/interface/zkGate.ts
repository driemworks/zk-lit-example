// src/zkgate.ts
import {
	type PublicClient,
	type WalletClient,
	type Address,
	type Hash,
	keccak256,
	encodeAbiParameters,
	parseAbiParameters,
} from "viem";
import { StorageProvider } from "./types.js";

export interface VaultEntry {
	cid: string;
	tag: string;
	provider: StorageProvider;
	createdAt: bigint;
}

const ZKGATE_ABI = [
	// Vault creation
	{
		name: "createVault",
		type: "function",
		stateMutability: "payable",
		inputs: [{ name: "passwordHash", type: "bytes32" }],
		outputs: [{ name: "vaultId", type: "bytes32" }],
	},
	// Entry management
	{
		name: "addEntry",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "vaultId", type: "bytes32" },
			{ name: "cid", type: "string" },
			{ name: "tag", type: "string" },
			{ name: "provider", type: "uint8" },
		],
		outputs: [{ name: "entryIndex", type: "uint256" }],
	},
	{
		name: "removeEntry",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "vaultId", type: "bytes32" },
			{ name: "entryIndex", type: "uint256" },
		],
		outputs: [],
	},
	// Proof submission
	{
		name: "submitProof",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "vaultId", type: "bytes32" },
			{ name: "nullifier", type: "bytes32" },
			{ name: "proof", type: "bytes" },
		],
		outputs: [],
	},
	// Read functions
	{
		name: "checkAccess",
		type: "function",
		stateMutability: "view",
		inputs: [
			{ name: "vaultId", type: "bytes32" },
			{ name: "user", type: "address" },
		],
		outputs: [{ type: "bool" }],
	},
	{
		name: "getEntryCount",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "vaultId", type: "bytes32" }],
		outputs: [{ type: "uint256" }],
	},
	{
		name: "getEntry",
		type: "function",
		stateMutability: "view",
		inputs: [
			{ name: "vaultId", type: "bytes32" },
			{ name: "entryIndex", type: "uint256" },
		],
		outputs: [
			{ name: "cid", type: "string" },
			{ name: "tag", type: "string" },
			{ name: "provider", type: "uint8" },
			{ name: "createdAt", type: "uint256" },
		],
	},
	{
		name: "getAllEntries",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "vaultId", type: "bytes32" }],
		outputs: [
			{
				type: "tuple[]",
				components: [
					{ name: "cid", type: "string" },
					{ name: "tag", type: "string" },
					{ name: "provider", type: "uint8" },
					{ name: "createdAt", type: "uint256" },
				],
			},
		],
	},
	{
		name: "vaultOwner",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "vaultId", type: "bytes32" }],
		outputs: [{ type: "address" }],
	},
	{
		name: "vaultPasswordHash",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "vaultId", type: "bytes32" }],
		outputs: [{ type: "bytes32" }],
	},
	{
		name: "spentNullifiers",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "nullifier", type: "bytes32" }],
		outputs: [{ type: "bool" }],
	},
	{
		name: "hasAccess",
		type: "function",
		stateMutability: "view",
		inputs: [
			{ name: "vaultId", type: "bytes32" },
			{ name: "user", type: "address" },
		],
		outputs: [{ type: "bool" }],
	},
	{
		name: "vaultCreationFee",
		type: "function",
		stateMutability: "view",
		inputs: [],
		outputs: [{ type: "uint256" }],
	},
	{
		name: "revokeOwnAccess",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [{ name: "vaultId", type: "bytes32" }],
		outputs: [],
	},
	// Events
	{
		name: "VaultCreated",
		type: "event",
		inputs: [
			{ name: "vaultId", type: "bytes32", indexed: true },
			{ name: "owner", type: "address", indexed: true },
		],
	},
	{
		name: "EntryAdded",
		type: "event",
		inputs: [
			{ name: "vaultId", type: "bytes32", indexed: true },
			{ name: "entryIndex", type: "uint256", indexed: true },
			{ name: "cid", type: "string", indexed: false },
			{ name: "tag", type: "string", indexed: false },
			{ name: "provider", type: "uint8", indexed: false },
		],
	},
	{
		name: "EntryRemoved",
		type: "event",
		inputs: [
			{ name: "vaultId", type: "bytes32", indexed: true },
			{ name: "entryIndex", type: "uint256", indexed: true },
		],
	},
	{
		name: "AccessGranted",
		type: "event",
		inputs: [
			{ name: "vaultId", type: "bytes32", indexed: true },
			{ name: "user", type: "address", indexed: true },
		],
	},
] as const;

export class ZKGate {
	private publicClient: PublicClient;
	private walletClient: WalletClient;
	private contractAddress: Address;

	constructor(
		contractAddress: Address,
		publicClient: PublicClient,
		walletClient: WalletClient,
	) {
		this.publicClient = publicClient;
		this.contractAddress = contractAddress;
		this.walletClient = walletClient;
	}

	private getWriteConfig() {
		if (!this.walletClient.chain) throw new Error("Chain required");
		if (!this.walletClient.account) throw new Error("Account required");
		return {
			chain: this.walletClient.chain,
			account: this.walletClient.account,
		};
	}

	// --- Read Functions ---

	async getVaultCreationFee(): Promise<bigint> {
		return this.publicClient.readContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "vaultCreationFee",
		});
	}

	async getVaultOwner(vaultId: `0x${string}`): Promise<Address> {
		return this.publicClient.readContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "vaultOwner",
			args: [vaultId],
		});
	}

	async getVaultPasswordHash(vaultId: `0x${string}`): Promise<`0x${string}`> {
		return this.publicClient.readContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "vaultPasswordHash",
			args: [vaultId],
		});
	}

	async checkAccess(vaultId: `0x${string}`, user: Address): Promise<boolean> {
		return this.publicClient.readContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "checkAccess",
			args: [vaultId, user],
		});
	}

	async isNullifierSpent(nullifier: `0x${string}`): Promise<boolean> {
		return this.publicClient.readContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "spentNullifiers",
			args: [nullifier],
		});
	}

	async vaultExists(vaultId: `0x${string}`): Promise<boolean> {
		const hash = await this.getVaultPasswordHash(vaultId);
		return (
			hash !==
			"0x0000000000000000000000000000000000000000000000000000000000000000"
		);
	}

	async getEntryCount(vaultId: `0x${string}`): Promise<bigint> {
		return this.publicClient.readContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "getEntryCount",
			args: [vaultId],
		});
	}

	async getEntry(
		vaultId: `0x${string}`,
		entryIndex: bigint,
	): Promise<VaultEntry> {
		const [cid, tag, provider, createdAt] =
			await this.publicClient.readContract({
				address: this.contractAddress,
				abi: ZKGATE_ABI,
				functionName: "getEntry",
				args: [vaultId, entryIndex],
			});
		return { cid, tag, provider: provider as StorageProvider, createdAt };
	}

	async getAllEntries(vaultId: `0x${string}`): Promise<VaultEntry[]> {
		const entries = await this.publicClient.readContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "getAllEntries",
			args: [vaultId],
		});
		return entries.map((e) => ({
			cid: e.cid,
			tag: e.tag,
			provider: e.provider as StorageProvider,
			createdAt: e.createdAt,
		}));
	}

	// --- Write Functions ---

	async createVault(
		passwordHash: `0x${string}`,
		fee: bigint,
	): Promise<{ hash: Hash; vaultId: `0x${string}` }> {
		const { chain, account } = this.getWriteConfig();

		const hash = await this.walletClient.writeContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "createVault",
			args: [passwordHash],
			value: fee,
			chain,
			account,
		});

		const vaultId = keccak256(
			encodeAbiParameters(parseAbiParameters("bytes32, address"), [
				passwordHash,
				account.address,
			]),
		);

		return { hash, vaultId };
	}

	async addEntry(
		vaultId: `0x${string}`,
		cid: string,
		tag: string,
		provider: StorageProvider,
	): Promise<Hash> {
		const { chain, account } = this.getWriteConfig();

		return this.walletClient.writeContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "addEntry",
			args: [vaultId, cid, tag, provider],
			chain,
			account,
		});
	}

	async removeEntry(vaultId: `0x${string}`, entryIndex: bigint): Promise<Hash> {
		const { chain, account } = this.getWriteConfig();

		return this.walletClient.writeContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "removeEntry",
			args: [vaultId, entryIndex],
			chain,
			account,
		});
	}

	async submitProof(
		vaultId: `0x${string}`,
		nullifier: `0x${string}`,
		proof: `0x${string}`,
	): Promise<Hash> {
		const { chain, account } = this.getWriteConfig();

		return this.walletClient.writeContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "submitProof",
			args: [vaultId, nullifier, proof],
			chain,
			account,
		});
	}

	async revokeOwnAccess(vaultId: `0x${string}`): Promise<Hash> {
		const { chain, account } = this.getWriteConfig();

		return this.walletClient.writeContract({
			address: this.contractAddress,
			abi: ZKGATE_ABI,
			functionName: "revokeOwnAccess",
			args: [vaultId],
			chain,
			account,
		});
	}

	// --- Helpers ---

	async waitForTransaction(hash: Hash) {
		return this.publicClient.waitForTransactionReceipt({ hash });
	}

	deriveVaultId(passwordHash: `0x${string}`, owner: Address): `0x${string}` {
		return keccak256(
			encodeAbiParameters(parseAbiParameters("bytes32, address"), [
				passwordHash,
				owner,
			]),
		);
	}
}
