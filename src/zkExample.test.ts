import { beforeAll, describe, it, expect } from "vitest";
import { Account, encodeFunctionData, Hex, parseEther, toHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { uploadLitActionToIpfs } from "./uploadToIpfs.js";
import { deployContracts } from "./deployContract.js";
import { runZkExample } from "./zkExample.js";

import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
// import * as circuit from '../circuit/target/circuit.json';
import { createRequire } from 'module';
import { createPublicClient, http } from 'viem';
import { baseSepolia, lineaSepolia } from 'viem/chains';

// Import everything to see what's available
import * as acvm from '@noir-lang/acvm_js';
import * as noirc from '@noir-lang/noirc_abi';
// import { BarretenbergBackend } from "@noir-lang/backend_barretenberg";

const require = createRequire(import.meta.url);

const circuit = require("../circuit/target/circuit.json");

// Load WASM as bytes
const acvmWasm = readFileSync(
    require.resolve('@noir-lang/acvm_js/web/acvm_js_bg.wasm')
);
const noircWasm = readFileSync(
    require.resolve('@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm')
);

// wasm-bindgen generated code often uses __wbg_init or initSync
const initAcvm = (acvm as any).__wbg_init || (acvm as any).initSync || (acvm as any).default;
const initNoirc = (noirc as any).__wbg_init || (noirc as any).initSync || (noirc as any).default;

if (typeof initAcvm === 'function') {
    await initAcvm(acvmWasm);
}
if (typeof initNoirc === 'function') {
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

describe("ZK-gated decryption", () => {
    let rpcUrl: string;
    let delegatorAccount: Account;
    let delegateeAccount: Account;
    let verifierContractAddress: Address;
    let zkGateAddress: Address;
    let contractAbi: any;
    let ipfsCid: string;

    beforeAll(async () => {

        rpcUrl = getEnv("CHAIN_RPC_URL");

        console.log('pk ' + getEnv("DELEGATOR_ETH_PRIVATE_KEY"))

        delegatorAccount = privateKeyToAccount(
            getEnv("DELEGATOR_ETH_PRIVATE_KEY") as Hex,
        );

        delegateeAccount = privateKeyToAccount(
            getEnv("DELEGATEE_ETH_PRIVATE_KEY") as Hex,
        );

        // Upload the Lit Action to IPFS
        console.log("\n=== Uploading Verifier Lit Action to IPFS ===");
        const litActionCode = readFileSync(
            join(__dirname, "./lit-actions/litAction.js"),
            "utf-8",
        );
        ipfsCid = await uploadLitActionToIpfs(litActionCode);
        console.log(`Verifier Lit Action CID: ${ipfsCid}`);

        // Deploy the Verifier contract
        console.log("\n=== Deploying Verifier Contract ===");

        // const deployment = await deployContracts({ account: delegatorAccount });

        // verifierContractAddress = deployment.verifierAddress;
        // zkGateAddress = deployment.zkGateAddress;

        verifierContractAddress = "0xb2e6c549e2fd5e72b4ae9a64d62551e24fac5dfd"
        zkGateAddress = "0x1defd93baac50db5ca112a7e84d9e86659db0966"

        // verifierAbi = deployment.verifierAbi;
        // zkGateAbi = deployment.zkGateAbi;

        console.log(`Verifier: ${verifierContractAddress}`);
        console.log(`ZKGate: ${zkGateAddress}`);
        // const deployment = await deployContract({ account: delegatorAccount });

        // verifierContractAddress = deployment.address;
        // contractAbi = deployment.abi;
        // console.log(`Verifier deployed at: ${verifierContractAddress}`);

    }, 120000); // 2 minute timeout for deployment

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
    //         console.log("Decryption failed as expected:", error);
    //     }

    //     expect(didFail).toBe(true);
    // }, 120000);

    it("should succeed to decrypt when the proof is valid", async () => {
        const api = await Barretenberg.new({ threads: 1 });
        const backend = new UltraHonkBackend(circuit.bytecode, api);
        const noir = new Noir(circuit);

        const inputs = { x: "1", y: "2" };
        const { witness } = await noir.execute(inputs);
        console.log("Generated witness");

        const proofResult = await backend.generateProof(witness, { verifierTarget: 'evm' });
        console.log("Generated proof");

        const proofBytes = proofResult.proof;
        const proofHex: Hex = toHex(proofResult.proof);

        const publicInputs = proofResult.publicInputs.map(input => {
            const clean = input.startsWith('0x') ? input.slice(2) : input;
            return `0x${clean.padStart(64, '0')}` as `0x${string}`;
        });

        console.log("Proof hex length:", proofHex.length);
        console.log("Original proof length:", proofBytes.length);
        console.log("Proof byte length:", proofResult.proof.length);
        console.log("Public inputs count:", proofResult.publicInputs.length);
        console.log("Public inputs:", publicInputs);

        // Test verification locally first
        const publicClient = createPublicClient({
            chain: lineaSepolia,
            transport: http(rpcUrl)
        });

        const verifierAbi = [
            {
                name: 'verify',
                type: 'function',
                stateMutability: 'view',
                inputs: [
                    { name: '_proof', type: 'bytes' },
                    { name: '_publicInputs', type: 'bytes32[]' }
                ],
                outputs: [{ type: 'bool' }]
            },
        ] as const;

        console.log("\n=== Testing LOCAL verification ===");

        try {
            // sanity check
            console.log('Verifying proof...');
            const isValid = await backend.verifyProof(proofResult, { verifierTarget: 'evm' });
            if (!isValid) {
                throw new Error("First Local verification failed - proof is invalid");
            }

            console.log('Local verification success!');
            // verify against the contract directly
            // check against contract (locally - no lit action involved yet)
            // const localResult = await publicClient.readContract({
            //     address: verifierContractAddress,
            //     abi: verifierAbi,
            //     functionName: 'verify',
            //     args: [proofHex, publicInputs]
            // });

            const verifierCode = await publicClient.getCode({ address: verifierContractAddress });
            console.log("Verifier has code:", verifierCode && verifierCode !== '0x');

            // 2. Try calling the verifier directly (not through submitAndVerify)
            const callData = encodeFunctionData({
                abi: verifierAbi,
                functionName: 'verify',
                args: [proofHex, publicInputs],
            });

            const localResult = await publicClient.call({
                to: verifierContractAddress,
                data: callData,
                // gas: 20_000_000n,
            });

            console.log("Local verification result:", localResult);

            if (!localResult) {
                throw new Error("Local verification failed - proof is invalid");
            }
        } catch (e) {
            console.error("Local verification error:", e);
            throw e;
        }

        console.log("\n=== Testing via Lit Action ===");
        await runZkExample({
            delegatorAccount,
            delegateeAccount,
            verifierContractAddress,
            zkGateAddress,
            proofHex: proofHex,
            ipfsCid,
            // decryptIpfsCid,
        });

        console.log("Decryption succeeded!");
    }, 700000);
});