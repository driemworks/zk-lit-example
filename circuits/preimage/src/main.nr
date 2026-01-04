// A circuit for proving you know the preimage with a nullifier for replay protection

use dep::keccak256::keccak256;
use dep::poseidon2;
use dep::std;
use std::hash::pedersen_hash;

// Merkle tree depth
// 8 levels => 2^8 = 256 max CIDs, 16 levels => 2^16 = 65536 max CIDs
global TREE_DEPTH: u32 = 8;

fn main(
    // Private inputs
    password: [u8; 32],
    cid_leaf: Field,
    merkle_path: [Field; TREE_DEPTH],
    merkle_indices: [Field; TREE_DEPTH],
    // Public inputs
    expected_hash: pub [u8; 32],
    merkle_root: pub Field,
    // We can make the user address private later on
    // for example, with a commitment scheme + one-time registration
    user_address: pub [u8; 32],
    vault_id: pub [u8; 32],
    nullifier: pub [u8; 32],
) {
    // verify password
    let hash_out = keccak256(password, 32);
    assert_eq(hash_out, expected_hash);

    // verify CID is in Merkle tree
    let computed_root = compute_merkle_root(cid_leaf, merkle_path, merkle_indices);
    assert_eq(computed_root, merkle_root);

    // build nullifier
    // one proof per user per vault per CID
    let mut nullifier_input: [u8; 128] = [0; 128];
    let cid: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = cid[i];
    }

    assert_eq(std::hash::blake3(nullifier_input), nullifier);
}

// Compute Merkle root
fn compute_merkle_root(leaf: Field, path_indices: [Field], siblings: [Field]) -> Field {
    let n = siblings.len();
    let mut current = leaf;
    for i in 0..n {
        let is_right = (path_indices[i] == 1) as bool;
        let (hash_left, hash_right) = if is_right {
            (siblings[i], current)
        } else {
            (current, siblings[i])
        };

        current = poseidon2::bn254::hash_2([hash_left, hash_right]);
        // make sure the ts code uses poseidon too!!!
        // current = poseidon2::bn254::hash_2([hash_left, hash_right]);
    }
    current
}

#[test]
fn test_poseidon_vectors() {
    let h1 = pedersen_hash([12345, 2]);
    std::println(h1);
}

#[test]
fn test_valid_proof() {
    // Password
    let password: [u8; 32] = [1; 32];
    let expected_hash = keccak256(password, 32);

    // User and vault
    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];

    // CID leaf (as a Field)
    let cid_leaf: Field = 12345;
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    // Build a simple Merkle tree with one leaf
    // For depth 8, we need 7 siblings (the leaf is level 0)
    // Actually for TREE_DEPTH iterations, we need TREE_DEPTH siblings

    // Single leaf tree: leaf is the only real value, all siblings are zeros
    let mut merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH]; // All left

    // Compute the expected root by hashing up the tree
    let mut current = cid_leaf;
    for i in 0..TREE_DEPTH {
        let sibling = merkle_path[i];
        // index 0 means current is on left
        current = poseidon2::bn254::hash_2([current, sibling]);
    }
    let merkle_root = current;

    // Build nullifier (128 bytes: password + user + vault + cid)
    let mut nullifier_input: [u8; 128] = [0; 128];
    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = cid_bytes[i];
    }
    let nullifier = std::hash::blake3(nullifier_input);

    // Run the circuit
    main(
        password,
        cid_leaf,
        merkle_path,
        merkle_indices,
        expected_hash,
        merkle_root,
        user_address,
        vault_id,
        nullifier,
    );
}

// TODO
// #[test]
// fn test_multiple_leaves() {
//     // Password
//     let password: [u8; 32] = [1; 32];
//     let expected_hash = keccak256(password, 32);

//     let user_address: [u8; 32] = [2; 32];
//     let vault_id: [u8; 32] = [3; 32];

//     // Two leaves: our CID at index 0, another at index 1
//     let cid_leaf: Field = 111;
//     let other_leaf: Field = 222;
//     let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

//     // Level 0: [cid_leaf, other_leaf, 0, 0, ...]
//     // Level 1: [hash(cid_leaf, other_leaf), hash(0, 0), ...]
//     // ...

//     // For index 0, sibling at level 0 is other_leaf
//     let mut merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
//     merkle_path[0] = other_leaf; // Sibling at level 0

//     let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH]; // Index 0 = all left

//     // Compute root
//     let mut current = cid_leaf;
//     for i in 0..TREE_DEPTH {
//         let sibling = merkle_path[i];
//         current = poseidon2::bn254::hash_2([current, sibling]);
//     }
//     let merkle_root = current;

//     // Nullifier
//     let mut nullifier_input: [u8; 128] = [0; 128];
//     for i in 0..32 {
//         nullifier_input[i] = password[i];
//         nullifier_input[i + 32] = user_address[i];
//         nullifier_input[i + 64] = vault_id[i];
//         nullifier_input[i + 96] = cid_bytes[i];
//     }
//     let nullifier = std::hash::blake3(nullifier_input);

//     main(
//         password,
//         cid_leaf,
//         merkle_path,
//         merkle_indices,
//         expected_hash,
//         merkle_root,
//         user_address,
//         vault_id,
//         nullifier,
//     );
// }

#[test(should_fail)]
fn test_wrong_password_fails() {
    let password: [u8; 32] = [1; 32];
    let wrong_password: [u8; 32] = [9; 32]; // Wrong!
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];
    let cid_leaf: Field = 12345;
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    let merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH];

    let mut current = cid_leaf;
    for i in 0..TREE_DEPTH {
        current = poseidon2::bn254::hash_2([current, merkle_path[i]]);
    }
    let merkle_root = current;

    let mut nullifier_input: [u8; 128] = [0; 128];
    for i in 0..32 {
        nullifier_input[i] = wrong_password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = cid_bytes[i];
    }
    let nullifier = std::hash::blake3(nullifier_input);

    // Should fail because wrong_password doesn't hash to expected_hash
    main(
        wrong_password,
        cid_leaf,
        merkle_path,
        merkle_indices,
        expected_hash,
        merkle_root,
        user_address,
        vault_id,
        nullifier,
    );
}

#[test(should_fail)]
fn test_wrong_cid_fails() {
    let password: [u8; 32] = [1; 32];
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];

    let real_cid: Field = 111;
    let fake_cid: Field = 999; // Not in tree!
    let fake_cid_bytes: [u8; 32] = fake_cid.to_be_bytes::<32>();

    // Tree built with real_cid
    let merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH];

    let mut current = real_cid;
    for i in 0..TREE_DEPTH {
        current = poseidon2::bn254::hash_2([current, merkle_path[i]]);
    }
    let merkle_root = current;

    let mut nullifier_input: [u8; 128] = [0; 128];
    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = fake_cid_bytes[i];
    }
    let nullifier = std::hash::blake3(nullifier_input);

    // Should fail because fake_cid doesn't produce merkle_root
    main(
        password,
        fake_cid,
        merkle_path,
        merkle_indices,
        expected_hash,
        merkle_root,
        user_address,
        vault_id,
        nullifier,
    );
}
