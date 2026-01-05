import { beforeAll, describe, it, expect } from "vitest";
import {
	Account,
	encodeFunctionData,
	Hex,
	parseEther,
	toHex,
	type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { uploadToPinata } from "./uploadToIpfs.js";
import { deployContracts } from "./deployContract.js";
import { runZkExample } from "./zkExample.js";
import { createRequire } from "module";

// Import everything to see what's available
import * as acvm from "@noir-lang/acvm_js";
import * as noirc from "@noir-lang/noirc_abi";
const require = createRequire(import.meta.url);

// Load WASM as bytes
const acvmWasm = readFileSync(
	require.resolve("@noir-lang/acvm_js/web/acvm_js_bg.wasm"),
);
const noircWasm = readFileSync(
	require.resolve("@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm"),
);

// wasm-bindgen generated code often uses __wbg_init or initSync
const initAcvm =
	(acvm as any).__wbg_init || (acvm as any).initSync || (acvm as any).default;
const initNoirc =
	(noirc as any).__wbg_init ||
	(noirc as any).initSync ||
	(noirc as any).default;

if (typeof initAcvm === "function") {
	await initAcvm(acvmWasm);
}
if (typeof initNoirc === "function") {
	await initNoirc(noircWasm);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getEnv = (key: string) => {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Environment variable ${key} is not set`);
	}
	return value;
};

const doDeploy = true;

describe("ZK-gated decryption", () => {
	let rpcUrl: string;
	let delegatorAccount: Account;
	let delegateeAccount: Account;
	let verifierContractAddress: Address;
	let zkGateAddress: Address;
	let ipfsCid: string;

	beforeAll(async () => {
		rpcUrl = getEnv("CHAIN_RPC_URL");

		console.log("pk " + getEnv("DELEGATOR_ETH_PRIVATE_KEY"));

		delegatorAccount = privateKeyToAccount(
			getEnv("DELEGATOR_ETH_PRIVATE_KEY") as Hex,
		);

		delegateeAccount = privateKeyToAccount(
			getEnv("DELEGATEE_ETH_PRIVATE_KEY") as Hex,
		);

		if (doDeploy) {
			// upload lit action
			// Upload the Lit Action to IPFS
			console.log("\n=== Uploading Verifier Lit Action to IPFS ===");
			const litActionCode = readFileSync(
				join(__dirname, "./lit-actions/litAction.js"),
				"utf-8",
			);
			ipfsCid = await uploadToPinata("lit-action.js", litActionCode);

			// Deploy the Verifier contract
			console.log("\n=== Deploying Verifier Contract ===");
			// deploy contracts
			const deployment = await deployContracts({ account: delegatorAccount });
			verifierContractAddress = deployment.verifierAddress;
			zkGateAddress = deployment.zkGateAddress;
		} else {
			ipfsCid = "QmdUfVyBCChoWinGh1XbVkYrL3p5GMMMoqDmf1iCBPv42u";
			verifierContractAddress = "0x49f7483e731514a746f0e4ef22df5a52c312d532";
			zkGateAddress = "0x738e4bf543a8cc3789853e5c0b44334a13085bdd";
		}

		console.log(`✅ Lit Action uploaded to IPFS with CID: ${ipfsCid}`);
		// verifierAbi = deployment.verifierAbi;
		// zkGateAbi = deployment.zkGateAbi;

		console.log(`Verifier: ${verifierContractAddress}`);
		console.log(`ZKGate: ${zkGateAddress}`);
	}, 120000); // 2 minute timeout for deployment

	// it("should generate prover.toml vals", async () => {
	// 	generateInputs();
	// });

	// it("should fail to decrypt when the proof is invalid", async () => {
	//     // using a dummy circuit for now, you just have to prove that you
	//     // know two numbers that are different, so it fails by supplying two same numbers
	//     let didFail = false;

	//     try {
	//         // invalid proof data
	//         let proofHex = "61" // 'a'

	//         await runZkExample({
	//             delegatorAccount,
	//             delegateeAccount,
	//             verifierContractAddress,
	//             proofHex,
	//             ipfsCid,
	//         });
	//     } catch (error) {
	//         didFail = true;
	//         console.log("Decryption failed  as expected:", error);
	//     }

	//     expect(didFail).toBe(true);
	// }, 120000);
	it("should succeed to decrypt when the proof is valid", async () => {
		// let input = [12345, 2];
		// let hash = await poseidon2Hash(12345, 1);
		// console.log(hash);

		console.log("\n=== Testing via Lit Action ===");
		await runZkExample({
			delegatorAccount,
			delegateeAccount,
			verifierContractAddress,
			zkGateAddress,
			// proofHex: proofHex,
			ipfsCid,
			// decryptIpfsCid,
		});

		console.log("Decryption succeeded!");
	}, 700_000);
});
