// const rpcUrl = "https://sepolia.base.org";
// const rpcUrl = "https://sepolia-rpc.scroll.io";
const rpcUrl = "https://rpc.sepolia.linea.build";
// const rpcUrl = "https://sepolia.era.zksync.dev";
// local (w/ ngrok)
// const rpcUrl = "https://untrainable-milton-gawky.ngrok-free.dev"
const go = async (zkGateAddress, verifierAddress) => {
    const callerAddress = Lit.Auth.authSigAddress;

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const zkGate = new ethers.Contract(
        zkGateAddress,
        ["function checkAccess(address user, address verifier) view returns (bool)"],
        provider
    );

    const hasAccess = await zkGate.checkAccess(callerAddress, verifierAddress);

    return hasAccess.toString();
};

go();