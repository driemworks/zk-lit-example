const rpcUrl = "https://sepolia.base.org";

const go = async (zkGateAddress, verifierAddress) => {
	const callerAddress = Lit.Auth.authSigAddress;
	const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

	const zkGate = new ethers.Contract(
		zkGateAddress,
		[
			"function checkAccess(address user, address verifier) view returns (bool)",
		],
		provider,
	);

	const hasAccess = await zkGate.checkAccess(callerAddress, verifierAddress);
	return hasAccess.toString();
};
