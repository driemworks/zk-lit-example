// const rpcUrl = "https://sepolia.base.org";

// const go = async (zkGateAddress, vaultId) => {
// 	const callerAddress = Lit.Auth.authSigAddress;
// 	const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

// 	const zkGate = new ethers.Contract(
// 		zkGateAddress,
// 		[
// 			"function checkAccess(bytes32 vaultId, address user) view returns (bool)",
// 		],
// 		provider,
// 	);

// 	const hasAccess = await zkGate.checkAccess(vaultId, callerAddress);
// 	return hasAccess.toString();
// };

const rpcUrl = "https://sepolia.base.org";

// const go = async (zkGateAddress, vaultId) => {
// 	const callerAddress = Lit.Auth.authSigAddress;
// 	const requestedCid = jsParams.requestedCid;
// 	const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

// 	const zkGate = new ethers.Contract(
// 		zkGateAddress,
// 		[
// 			"function checkAccess(bytes32 vaultId, address user) view returns (bool)",
// 			"function getAllEntries(bytes32 vaultId) view returns (tuple(string cid, string tag, uint8 provider, uint256 createdAt)[])",
// 		],
// 		provider,
// 	);

// 	// check vault access
// 	const hasAccess = await zkGate.checkAccess(vaultId, callerAddress);
// 	// check CID exists in vault
// 	const entries = await zkGate.getAllEntries(vaultId);
// 	const cidFound = entries.some((entry) => entry.cid === requestedCid);

// 	return (hasAccess && cidFound).toString();
// };

// This runs on the Lit Nodes
const go = async () => {
	// 1. Get static info from the 'acc' lock
	const [zkGateAddress, vaultId] = params;

	// 2. Get dynamic info from your decrypt call
	const { requestedCid, ciphertext, dataToEncryptHash } = jsParams;

	// 3. Query the Contract
	const provider = new ethers.providers.JsonRpcProvider(
		"https://sepolia.base.org",
	);
	const zkGate = new ethers.Contract(zkGateAddress, ["..."], provider);

	const hasAccess = await zkGate.checkAccess(vaultId, Lit.Auth.authSigAddress);
	const entries = await zkGate.getAllEntries(vaultId);
	const cidFound = entries.some((e) => e.cid === requestedCid);

	// 4. THE GATE: Only decrypt if both are true
	if (hasAccess && cidFound) {
		const decrypted = await Lit.Actions.decryptAndCombine({
			ciphertext,
			dataToEncryptHash,
			chain: "baseSepolia",
			unifiedAccessControlConditions: [
				/* the acc you made */
			],
		});
		Lit.Actions.setResponse({ response: decrypted });
	} else {
		Lit.Actions.setResponse({ response: "Access Denied" });
	}
};
go();
