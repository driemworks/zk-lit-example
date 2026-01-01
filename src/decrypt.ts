import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { Address, Hex, toHex } from "viem";
import { baseSepolia } from "viem/chains";

export const decrypt = async (
	publicClient: any,
	walletClient: any,
	litClient: any,
	authContext: any,
	ciphertext: string,
	acc: any,
	circuit: any,
	privateInputs: any,
	zkGateAddress: Hex,
	verifierContractAddress: Hex,
	zkGateAbi: any,
) => {
	// prepare the proof
	let api = await Barretenberg.new({ threads: 1 });
	const backend = new UltraHonkBackend(circuit.bytecode, api);
	const noir = new Noir(circuit);

	const { witness } = await noir.execute(privateInputs);
	console.log("Generated witness");

	const proofResult = await backend.generateProof(witness, {
		verifierTarget: "evm",
	});
	console.log("Generated proof");

	// const proofBytes = proofResult.proof;
	const proofHex: Hex = toHex(proofResult.proof);
	// const publicInputs = proofResult.publicInputs.map((input) => {
	//     const clean = input.startsWith("0x") ? input.slice(2) : input;
	//     return `0x${clean.padStart(64, "0")}` as `0x${string}`;
	// });

	const gasPrice = await publicClient.getGasPrice();
	// submit to zk gate
	const gas = await publicClient.estimateContractGas({
		address: zkGateAddress,
		abi: zkGateAbi,
		functionName: "submitAndVerify",
		args: [
			verifierContractAddress as Address,
			proofHex as Hex,
			[] as `0x${string}`[],
		],
		account: walletClient.account,
	});

	console.log("Estimated gas:", gas);
	const hash = await walletClient.writeContract({
		address: zkGateAddress as Hex,
		abi: zkGateAbi,
		functionName: "submitAndVerify",
		args: [
			verifierContractAddress as Address,
			proofHex as Hex,
			[] as `0x${string}`[],
		],
		chain: baseSepolia,
		// 10% buffer
		gas: gas + gas / 10n,
		gasPrice: gasPrice * 2n,
	});

	// sanity check
	// Right after transaction succeeds
	const txReceipt = await publicClient.waitForTransactionReceipt({ hash });
	console.log("Transaction confirmed in block:", txReceipt.blockNumber);
	console.log("Transaction status:", txReceipt.status);

	console.log("Transaction receipt:", txReceipt);
	console.log("Logs:", txReceipt.logs);

	// request decryption
	const decryptedResponse = await litClient.decrypt({
		data: ciphertext,
		unifiedAccessControlConditions: acc,
		authContext,
		chain: "baseSepolia",
	});
	console.log("Decrypted response:", decryptedResponse);
};
