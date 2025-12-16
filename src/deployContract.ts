import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
	createWalletClient,
	createPublicClient,
	http,
	type Account,
	type Address,
	type Hex,
} from "viem";
import solc from "solc";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const circuit = require("../circuit/target/circuit.json");

/**
 * Compiles all contracts in Verifier.sol
 */
async function compileContracts(): Promise<Record<string, { abi: any; bytecode: string }>> {
	// const contractPath = join(__dirname, "..", "./circuit/target", "Verifier.sol");
	// const source = readFileSync(contractPath, "utf-8");


	// const circuitPath = join(__dirname, "..", "circuit/target", "circuit.json");
	// const circuit = readFileSync(contractPath, "utf-8");
	const api = await Barretenberg.new({ threads: 1 });
    const backend = new UltraHonkBackend(circuit.bytecode, api);
	const vk = await backend.getVerificationKey({ verifierTarget: 'evm' });
	const contractString = await backend.getSolidityVerifier(vk, { verifierTarget: 'evm' });

	const input = {
		language: "Solidity",
		sources: {
			"Verifier.sol": {content: contractString }
		},
		settings: {
			metadata: {
				// Prevents appending CBOR metadata hash
				appendCBOR: false,
				useLiteralContent: false,
			},
			optimizer: { enabled: true, runs: 1 },
			outputSelection: {
				"*": { "*": ["abi", "evm.bytecode"] },
			},
		},
	};

	const output = JSON.parse(solc.compile(JSON.stringify(input)));

	if (output.errors?.some((e: any) => e.severity === "error")) {
		console.error("Compilation errors:", output.errors.filter((e: any) => e.severity === "error"));
		throw new Error("Contract compilation failed");
	}

	const contracts: Record<string, { abi: any; bytecode: string }> = {};
	for (const [name, contract] of Object.entries(output.contracts["Verifier.sol"])) {
		contracts[name] = {
			abi: (contract as any).abi,
			bytecode: (contract as any).evm.bytecode.object,
		};
	}

	console.log(`Compiled: ${Object.keys(contracts).join(", ")}`);
	return contracts;
}

/**
 * Links library addresses into bytecode AND strips the linker boilerplate.
 * This is crucial for ZK Verifiers to fit the EIP-170 size limit.
 */
function linkBytecode(bytecode: string, libraries: Record<string, Address>): Hex {
    let linked = bytecode;

    for (const [, libAddress] of Object.entries(libraries)) {
        linked = linked.replace(/__\$[a-fA-F0-9]{34}\$__/g, libAddress.slice(2).toLowerCase());
    }

    const remaining = linked.match(/__\$[a-fA-F0-9]{34}\$__/);
    if (remaining) {
        throw new Error(`Unlinked library: ${remaining[0]}`);
    }
    
    // Remove the stripping - it's breaking the contract
    return `0x${linked}` as Hex;
}

/**
 * Deploys the HonkVerifier contract with ZKTranscriptLib
 */
export async function deployContract({ account }: { account: Account }): Promise<{ address: Address; abi: any }> {
	console.log("Compiling HonkVerifier contract...");
	const contracts = await compileContracts();

	const rpcUrl = process.env.CHAIN_RPC_URL;
	if (!rpcUrl) throw new Error("CHAIN_RPC_URL environment variable is required");

	const publicClient = createPublicClient({ transport: http(rpcUrl) });
	const walletClient = createWalletClient({ account, transport: http(rpcUrl) });

	// 1. Deploy ZKTranscriptLib first
	console.log("Deploying ZKTranscriptLib...");
	const libBytecode = contracts["ZKTranscriptLib"]?.bytecode;
	if (!libBytecode) throw new Error("ZKTranscriptLib not found");

	const libHash = await walletClient.deployContract({
		abi: contracts["ZKTranscriptLib"].abi,
		bytecode: `0x${libBytecode}` as Hex,
		args: [],
		chain: undefined,
	});
	const libReceipt = await publicClient.waitForTransactionReceipt({ hash: libHash });
	const libAddress = libReceipt.contractAddress!;
	console.log(`ZKTranscriptLib deployed: ${libAddress}`);

	// 2. Deploy HonkVerifier with linked library
	console.log("Deploying HonkVerifier...");
	const verifier = contracts["HonkVerifier"];
	if (!verifier) throw new Error("HonkVerifier not found");

	const linkedBytecode = linkBytecode(verifier.bytecode, { ZKTranscriptLib: libAddress });

	const hash = await walletClient.deployContract({
		abi: verifier.abi,
		bytecode: linkedBytecode,
		args: [],
		chain: undefined,
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	console.log(`HonkVerifier deployed: ${receipt.contractAddress}`);

	await new Promise((r) => setTimeout(r, 2000));

	return { address: receipt.contractAddress!, abi: verifier.abi };
}

/**
 * Verifies a proof using the deployed HonkVerifier contract
 */
export async function verifyProof({
	contractAddress,
	abi,
	proof,
	publicInputs,
}: {
	contractAddress: Address;
	abi: any;
	proof: Hex;
	publicInputs: Hex[];
}): Promise<boolean> {
	const rpcUrl = process.env.CHAIN_RPC_URL;
	if (!rpcUrl) throw new Error("CHAIN_RPC_URL environment variable is required");

	const publicClient = createPublicClient({ transport: http(rpcUrl) });

	const result = await publicClient.readContract({
		address: contractAddress,
		abi,
		functionName: "verify",
		args: [proof, publicInputs],
	});

	console.log(`Verification result: ${result}`);
	return result as boolean;
}