const rpcUrl = "https://sepolia.base.org";

const go = async (verifierContractAddress, proof) => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const verifierAbi = [
            "function verify(bytes calldata _proof, bytes32[] calldata _publicInputs) external view returns (bool)"
        ];
        const verifierContract = new ethers.Contract(
            verifierContractAddress,
            verifierAbi,
            provider
        );

        const isValid = await verifierContract.callStatic.verify(proof, []);

        Lit.Actions.setResponse({
            response: JSON.stringify({
                verified: isValid,
            })
        });

        return isValid;
    } catch (e) {
        console.error("Verification error:", e);
        Lit.Actions.setResponse({
            response: JSON.stringify({
                verified: false,
                error: e.message,
                errorCode: e.code
            })
        });
        return false;
    }
};

go();