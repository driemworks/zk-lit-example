import { createAccBuilder } from "@lit-protocol/access-control-conditions";

export const encryptWithZkCondition = async (
	litClient: any,
	plaintext: string,
	zkGateAddress: string,
	vaultId: string,
	ipfsCid: string,
) => {
	// acc: the caller must have verified a proof under verifierContractAddress
	// in the context of the zkgate contract
	const acc = createAccBuilder()
		.requireLitAction(ipfsCid, "go", [zkGateAddress, vaultId], "true")
		.build();

	const encryptedData = await litClient.encrypt({
		dataToEncrypt: plaintext,
		unifiedAccessControlConditions: acc,
		chain: "baseSepolia",
	});
	console.log("Encrypted data:", encryptedData);

	return {
		encryptedData,
		acc,
	};
};
