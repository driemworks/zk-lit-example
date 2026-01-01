// // fangorn.ts

// import { Noir } from '@noir-lang/noir_js';
// import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
// import { LitNodeClient } from '@lit-protocol/lit-node-client';
// import { ethers } from 'ethers';

// // Precompiled circuits
// import passwordCircuit from './circuits/password.json';
// import allowlistCircuit from './circuits/allowlist.json';
// import aggregatorCircuit from './circuits/aggregator.json';

// export class Fangorn {
//   private lit: LitNodeClient;
//   private provider: ethers.Provider;
//   private verifier: ethers.Contract;
//   private registry: ethers.Contract;

//   constructor(config: FangornConfig) {
//     this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
//     this.verifier = new ethers.Contract(config.verifierAddress, VERIFIER_ABI, this.provider);
//     this.registry = new ethers.Contract(config.registryAddress, REGISTRY_ABI, this.provider);
//   }

//   async connect() {
//     this.lit = new LitNodeClient({ litNetwork: 'datil' });
//     await this.lit.connect();
//   }

//   // ============ PREDICATES ============

//   static Password(preimageHash: string): PasswordPredicate {
//     return { type: 'password', hash: preimageHash };
//   }

//   static Allowlist(addresses: string[], message: string): AllowlistPredicate {
//     const root = computeMerkleRoot(addresses);
//     const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
//     return { type: 'allowlist', root, messageHash, addresses, message };
//   }

//   static And(...predicates: Predicate[]): AndPredicate {
//     return { type: 'and', predicates };
//   }

//   // ============ ENCRYPT ============

//   async encrypt(
//     data: string,
//     condition: Predicate
//   ): Promise<{ contentId: string; ciphertextCID: string }> {

//     // 1. Compute condition hash
//     const conditionHash = this.hashCondition(condition);

//     // 2. Encrypt with LIT
//     const { ciphertext, dataToEncryptHash } = await this.lit.encrypt({
//       dataToEncrypt: new TextEncoder().encode(data),
//       // ACC that checks our verifier contract
//       accessControlConditions: [{
//         contractAddress: this.verifier.address,
//         standardContractType: 'custom',
//         chain: 'base',
//         method: 'verifyAggregated',
//         parameters: [':userProof', conditionHash],
//         returnValueTest: { comparator: '=', value: 'true' }
//       }]
//     });

//     // 3. Upload to IPFS
//     const ciphertextCID = await this.uploadToIPFS({
//       ciphertext,
//       dataToEncryptHash,
//       condition
//     });

//     // 4. Register on-chain
//     const contentId = ethers.keccak256(ethers.toUtf8Bytes(ciphertextCID));
//     const tx = await this.registry.register(contentId, conditionHash, ciphertextCID);
//     await tx.wait();

//     return { contentId, ciphertextCID };
//   }

//   // ============ DECRYPT ============

//   async decrypt(
//     contentId: string,
//     witnesses: {
//       password?: string;
//       allowlist?: { signer: ethers.Signer };
//     }
//   ): Promise<string> {

//     // 1. Fetch condition from registry
//     const content = await this.registry.contents(contentId);
//     const { ciphertext, dataToEncryptHash, condition } = await this.fetchFromIPFS(content.ciphertextCID);

//     // 2. Generate individual proofs
//     const proofs: GeneratedProof[] = [];

//     for (const pred of this.flattenCondition(condition)) {
//       if (pred.type === 'password' && witnesses.password) {
//         const proof = await this.provePassword(pred.hash, witnesses.password);
//         proofs.push(proof);
//       }

//       if (pred.type === 'allowlist' && witnesses.allowlist) {
//         const proof = await this.proveAllowlist(
//           pred,
//           witnesses.allowlist.signer
//         );
//         proofs.push(proof);
//       }
//     }

//     // 3. Aggregate proofs
//     const aggregatedProof = await this.aggregateProofs(proofs, content.conditionHash);

//     // 4. Decrypt via LIT
//     const decrypted = await this.lit.executeJs({
//       code: FANGORN_LIT_ACTION,
//       jsParams: {
//         contentId,
//         aggregatedProof,
//         conditionHash: content.conditionHash,
//         ciphertext,
//         dataToEncryptHash
//       }
//     });

//     return new TextDecoder().decode(decrypted);
//   }

//   // ============ PROVING ============

//   private async provePassword(hash: string, preimage: string): Promise<GeneratedProof> {
//     const backend = new BarretenbergBackend(passwordCircuit);
//     const noir = new Noir(passwordCircuit, backend);

//     const { witness } = await noir.execute({
//       hash: hexToBytes(hash),
//       preimage: stringToBytes(preimage),
//       preimage_len: preimage.length
//     });

//     const proof = await backend.generateProof(witness);

//     return {
//       type: 'password',
//       proof: proof.proof,
//       publicInputs: [hash]
//     };
//   }

//   private async proveAllowlist(
//     pred: AllowlistPredicate,
//     signer: ethers.Signer
//   ): Promise<GeneratedProof> {

//     // Sign the message
//     const signature = await signer.signMessage(pred.message);
//     const signerAddress = await signer.getAddress();

//     // Get Merkle proof for address
//     const { proof: merkleProof, index } = getMerkleProof(pred.addresses, signerAddress);

//     // Get public key from signature
//     const pubKey = ethers.SigningKey.recoverPublicKey(
//       ethers.hashMessage(pred.message),
//       signature
//     );

//     const backend = new BarretenbergBackend(allowlistCircuit);
//     const noir = new Noir(allowlistCircuit, backend);

//     const { witness } = await noir.execute({
//       message_hash: hexToBytes(pred.messageHash),
//       allowlist_root: pred.root,
//       signature: hexToBytes(signature.slice(0, -2)), // Remove v
//       pub_key: hexToBytes(pubKey.slice(4)), // Remove 0x04 prefix
//       merkle_proof: merkleProof,
//       merkle_index: index
//     });

//     const proof = await backend.generateProof(witness);

//     return {
//       type: 'allowlist',
//       proof: proof.proof,
//       publicInputs: [pred.messageHash, pred.root]
//     };
//   }

//   private async aggregateProofs(
//     proofs: GeneratedProof[],
//     conditionHash: string
//   ): Promise<Uint8Array> {

//     const backend = new BarretenbergBackend(aggregatorCircuit);
//     const noir = new Noir(aggregatorCircuit, backend);

//     // Prepare inputs for aggregator
//     const inputs = {
//       condition_hash: conditionHash,
//       password_proof: proofs.find(p => p.type === 'password')?.proof,
//       password_public_inputs: proofs.find(p => p.type === 'password')?.publicInputs,
//       allowlist_proof: proofs.find(p => p.type === 'allowlist')?.proof,
//       allowlist_public_inputs: proofs.find(p => p.type === 'allowlist')?.publicInputs,
//       // VKs are hardcoded in circuit or passed as constants
//     };

//     const { witness } = await noir.execute(inputs);
//     const { proof } = await backend.generateProof(witness);

//     return proof;
//   }
// }
