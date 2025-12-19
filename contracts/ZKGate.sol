// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.21;

interface IVerifier {
	function verify(
		bytes calldata _proof,
		bytes32[] calldata _publicInputs
	) external view returns (bool);
}

contract ZKGate {
	// user => verifier => hasValidProof
	mapping(address => mapping(address => bool)) public hasValidProof;

	function submitAndVerify(
		address verifier,
		bytes calldata proof,
		bytes32[] calldata publicInputs
	) external returns (bool) {
		bool valid = IVerifier(verifier).verify(proof, publicInputs);

		require(valid, "ZKGate: PLONK verification failed");

		hasValidProof[msg.sender][verifier] = valid;
		return valid;
	}

	function checkAccess(
		address user,
		address verifier
	) external view returns (bool) {
		return hasValidProof[user][verifier];
	}

	function clearProof(address verifier) external {
		hasValidProof[msg.sender][verifier] = false;
	}
}
