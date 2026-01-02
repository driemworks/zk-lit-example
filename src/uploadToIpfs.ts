// /**
//  * Uploads a file to IPFS using Pinata
//  * @param filename - The name of the file
//  * @param fileContent - The content of the file
//  * @param pinataJwt - The Pinata JWT
//  * @returns The IPFS hash
//  */
// export async function uploadToIPFS(
// 	filename: string,
// 	fileContent: string,
// 	pinataJwt: string,
// ): Promise<string> {
// 	if (!pinataJwt) {
// 		throw new Error("PINATA_JWT is required");
// 	}

// 	try {
// 		const form = new FormData();
// 		form.append(
// 			"file",
// 			new Blob([fileContent], { type: "application/javascript" }),
// 			filename,
// 		);

// 		const response = await fetch(
// 			"https://api.pinata.cloud/pinning/pinFileToIPFS",
// 			{
// 				method: "POST",
// 				headers: {
// 					Authorization: `Bearer ${pinataJwt}`,
// 				},
// 				body: form,
// 			},
// 		);

// 		if (!response.ok) {
// 			const text = await response.text();
// 			throw new Error(`HTTP error! status: ${response.status} - ${text}`);
// 		}

// 		const data = await response.json();
// 		return data.IpfsHash;
// 	} catch (error) {
// 		console.error("Error uploading to IPFS:", error);
// 		throw error;
// 	}
// }

/**
 * Uploads any data to IPFS via Pinata
 */
export async function uploadToPinata(
	name: string,
	data: any,
	pinataJwt?: string,
): Promise<string> {
	const jwt = pinataJwt || process.env.PINATA_JWT;
	if (!jwt) throw new Error("PINATA_JWT is required");

	// If data is an object, stringify it
	const content =
		typeof data === "object" && !(data instanceof Blob)
			? JSON.stringify(data)
			: data;

	const contentType =
		typeof data === "object" ? "application/json" : "text/plain";

	const form = new FormData();
	form.append("file", new Blob([content], { type: contentType }), name);

	const response = await fetch(
		"https://api.pinata.cloud/pinning/pinFileToIPFS",
		{
			method: "POST",
			headers: { Authorization: `Bearer ${jwt}` },
			body: form,
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Upload failed: ${response.status} - ${text}`);
	}

	const resData = await response.json();
	return resData.IpfsHash;
}

/**
 * Downloads and parses content from IPFS via Pinata
 */
export async function downloadFromPinata(
	cid: string,
	pinataJwt?: string,
	gatewayUrl: string = "https://gateway.pinata.cloud",
): Promise<any> {
	const jwt = pinataJwt || process.env.PINATA_JWT;
	const url = `${gatewayUrl.replace(/\/$/, "")}/ipfs/${cid}`;

	const response = await fetch(url, {
		method: "GET",
		headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
	});

	if (!response.ok) {
		throw new Error(`Download failed: ${response.statusText}`);
	}

	const contentType = response.headers.get("content-type");

	// If it's JSON (like your encryption payload), parse it automatically
	if (contentType?.includes("application/json")) {
		return await response.json();
	}

	// Otherwise return as text (useful for Lit Action code)
	return await response.text();
}
