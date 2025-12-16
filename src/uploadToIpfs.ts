/**
 * Uploads a file to IPFS using Pinata
 * @param filename - The name of the file
 * @param fileContent - The content of the file
 * @param pinataJwt - The Pinata JWT
 * @returns The IPFS hash
 */
export async function uploadToIPFS(
	filename: string,
	fileContent: string,
	pinataJwt: string,
): Promise<string> {
	if (!pinataJwt) {
		throw new Error("PINATA_JWT is required");
	}

	try {
		const form = new FormData();
		form.append(
			"file",
			new Blob([fileContent], { type: "application/javascript" }),
			filename,
		);

		const response = await fetch(
			"https://api.pinata.cloud/pinning/pinFileToIPFS",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${pinataJwt}`,
				},
				body: form,
			},
		);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`HTTP error! status: ${response.status} - ${text}`);
		}

		const data = await response.json();
		return data.IpfsHash;
	} catch (error) {
		console.error("Error uploading to IPFS:", error);
		throw error;
	}
}

/**
 * Uploads a Lit Action to IPFS using Pinata
 * @param litActionCode - The Lit Action code as a string
 * @param pinataJwt - The Pinata JWT (optional, will use env var if not provided)
 * @returns The IPFS CID
 */
export async function uploadLitActionToIpfs(
	litActionCode: string,
	pinataJwt?: string,
): Promise<string> {
	const jwt = pinataJwt || process.env.PINATA_JWT;
	if (!jwt) {
		throw new Error(
			"PINATA_JWT environment variable or pinataJwt parameter is required",
		);
	}

	const ipfsCid = await uploadToIPFS("lit-action.js", litActionCode, jwt);
	console.log(`✅ Lit Action uploaded to IPFS with CID: ${ipfsCid}`);
	return ipfsCid;
}
