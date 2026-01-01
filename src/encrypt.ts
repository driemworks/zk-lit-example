import { createAccBuilder } from "@lit-protocol/access-control-conditions";

export const encryptWithZkCondition = async (
	litClient: any,
	plaintext: string,
	verifierContractAddress: string,
	zkGateAddress: string,
	ipfsCid: string,
) => {
	// acc: the caller must have verified a proof under verifierContractAddress
	// in the context of the zkgate contract
	const acc = createAccBuilder()
		.requireLitAction(
			ipfsCid,
			"go",
			[zkGateAddress, verifierContractAddress],
			"true",
		)
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
