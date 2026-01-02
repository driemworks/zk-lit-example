// A circuit for proving you know the preimage with a nullifier for replay protection

use keccak256::keccak256;

/// - `password` - The private witness
/// - `expected_hash` - The public vault password hash
/// - `user_address` - The wallet address of the user
/// - `vault_id` - The id of the vault unlocked by the password
/// - `nullifier` - The unique nullifier to prevent replay attacks
fn main(
    password: [u8; 32],
    expected_hash: pub [u8; 32],
    user_address: pub [u8; 32],
    vault_id: pub [u8; 32],
    nullifier: pub [u8; 32],
) {
    // keccak256 to match solidity hashing
    let hash_out = keccak256(password, 32);
    assert_eq(hash_out, expected_hash);

    // nullifier computed with blake3
    let mut nullifier_input: [u8; 96] = [0; 96];
    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
    }

    assert_eq(std::hash::blake3(nullifier_input), nullifier);
}

#[test]
fn test_valid_proof() {
    let password = [1; 32];
    let expected_hash = keccak256(password, 32);
    let user_address = [2; 32];
    let vault_id = [3; 32];

    let nullifier_input: [u8; 96] = password.concat(user_address).concat(vault_id);
    let nullifier = std::hash::blake3(nullifier_input);

    main(password, expected_hash, user_address, vault_id, nullifier);
}
