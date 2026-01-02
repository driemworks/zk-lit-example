// src/types.ts
export enum StorageProvider {
	Storacha = 0,
	Pinata = 1,
	IPFS = 2,
	Other = 3,
}

export interface VaultEntry {
	cid: string;
	tag: string;
	provider: StorageProvider;
	createdAt: bigint;
}
