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

const go = async (zkGateAddress, vaultId, _requestedCid) => {
	const callerAddress = Lit.Auth.authSigAddress;
	const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

	const zkGate = new ethers.Contract(
		zkGateAddress,
		[
			"function checkAccess(bytes32 vaultId, address user) view returns (bool)",
			"function getAllEntries(bytes32 vaultId) view returns (tuple(string cid, string tag, uint8 provider, uint256 createdAt)[])",
		],
		provider,
	);

	// check vault access
	const hasAccess = await zkGate.checkAccess(vaultId, callerAddress);
	if (!hasAccess) {
		Lit.Actions.setResponse({
			response: JSON.stringify({ success: false, error: "No vault access" }),
		});
		return;
	}

	// // check CID exists in vault
	// const entries = await zkGate.getAllEntries(vaultId);
	// const cidFound = entries.some((entry) => entry.cid === requestedCid);

	// if (!cidFound) {
	// 	Lit.Actions.setResponse({ response: JSON.stringify({ success: false, error: "CID not in vault" }) });
	// 	return;
	// }

	// success!
	Lit.Actions.setResponse({ response: JSON.stringify({ success: true }) });

	return true.toString();
};
