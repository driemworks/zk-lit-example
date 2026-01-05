// A circuit for proving you know the preimage with a nullifier for replay protection

use dep::keccak256::keccak256;
use dep::poseidon2;
use dep::std;
use std::hash::pedersen_hash;

// Merkle tree depth
// 8 levels => 2^8 = 256 max CIDs, 16 levels => 2^16 = 65536 max CIDs
global TREE_DEPTH: u32 = 8;

// TODO: should we salt the password? e.g. to prevent rainbow table attacks
// TODO: can tree depth be dynamic?

fn main(
    // Private inputs
    password: [u8; 32],
    cid_leaf: Field,
    merkle_path: [Field; TREE_DEPTH],
    merkle_indices: [Field; TREE_DEPTH],
    
    // Public inputs
    expected_hash: pub [u8; 32],
    merkle_root: pub Field,
    user_address: pub [u8; 32],
    vault_id: pub [u8; 32],
    nullifier: pub [u8; 32],
    cid_commitment: pub Field,  // poseidon(cid_leaf) - LIT uses this
) {
    // 1. Verify password
    let hash_out = keccak256(password, 32);
    assert_eq(hash_out, expected_hash);
    
    // 2. Verify CID is in Merkle tree
    let computed_root = compute_merkle_root(cid_leaf, merkle_indices, merkle_path);
    assert_eq(computed_root, merkle_root);
    
    // 3. Verify CID commitment (so LIT knows which CID)
    let computed_commitment = poseidon2::bn254::hash_1([cid_leaf]);
    assert_eq(computed_commitment, cid_commitment);
    
    // 4. Verify nullifier
    let mut nullifier_input: [u8; 128] = [0; 128];
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();
    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = cid_bytes[i];
    }
    assert_eq(std::hash::blake3(nullifier_input), nullifier);
}

fn compute_merkle_root(leaf: Field, path_indices: [Field; TREE_DEPTH], siblings: [Field; TREE_DEPTH]) -> Field {
    let mut current = leaf;
    for i in 0..TREE_DEPTH {
        let is_right = (path_indices[i] == 1) as bool;
        let (left, right) = if is_right {
            (siblings[i], current)
        } else {
            (current, siblings[i])
        };
        current = poseidon2::bn254::hash_2([left, right]);
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

    // CID leaf
    let cid_leaf: Field = 12345;
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    // CID commitment
    let cid_commitment = poseidon2::bn254::hash_1([cid_leaf]);

    // Single leaf tree: all siblings are zeros
    let merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH];

    // Compute merkle root
    let mut current = cid_leaf;
    for i in 0..TREE_DEPTH {
        let sibling = merkle_path[i];
        current = poseidon2::bn254::hash_2([current, sibling]);
    }
    let merkle_root = current;

    // Build nullifier
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
        cid_commitment,
    );
}

#[test]
fn test_multiple_leaves() {
    // Password
    let password: [u8; 32] = [1; 32];
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];

    // Two leaves: our CID at index 0, another at index 1
    let cid_leaf: Field = 111;
    let other_leaf: Field = 222;
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    // CID commitment
    let cid_commitment = poseidon2::bn254::hash_1([cid_leaf]);

    // For index 0, sibling at level 0 is other_leaf
    let mut merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    merkle_path[0] = other_leaf;

    let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH]; // Index 0 = all left

    // Compute root
    let mut current = cid_leaf;
    for i in 0..TREE_DEPTH {
        let sibling = merkle_path[i];
        current = poseidon2::bn254::hash_2([current, sibling]);
    }
    let merkle_root = current;

    // Nullifier
    let mut nullifier_input: [u8; 128] = [0; 128];
    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = cid_bytes[i];
    }
    let nullifier = std::hash::blake3(nullifier_input);

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
        cid_commitment,
    );
}

#[test]
fn test_leaf_at_index_1() {
    // Test accessing the second leaf (index 1)
    let password: [u8; 32] = [1; 32];
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];

    let first_leaf: Field = 111;
    let cid_leaf: Field = 222; // We're proving access to this one
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    let cid_commitment = poseidon2::bn254::hash_1([cid_leaf]);

    // For index 1, sibling at level 0 is first_leaf, and we're on the right
    let mut merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    merkle_path[0] = first_leaf;

    // Index 1 = binary 00000001, so first bit is 1 (right), rest are 0 (left)
    let mut merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    merkle_indices[0] = 1; // Right at level 0

    // Compute root: at level 0, we're on right so hash(first_leaf, cid_leaf)
    let mut current = cid_leaf;
    for i in 0..TREE_DEPTH {
        let sibling = merkle_path[i];
        let is_right = (merkle_indices[i] == 1) as bool;
        let (left, right) = if is_right {
            (sibling, current)
        } else {
            (current, sibling)
        };
        current = poseidon2::bn254::hash_2([left, right]);
    }
    let merkle_root = current;

    let mut nullifier_input: [u8; 128] = [0; 128];
    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = cid_bytes[i];
    }
    let nullifier = std::hash::blake3(nullifier_input);

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
        cid_commitment,
    );
}

#[test(should_fail)]
fn test_wrong_password_fails() {
    let password: [u8; 32] = [1; 32];
    let wrong_password: [u8; 32] = [9; 32];
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];
    let cid_leaf: Field = 12345;
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    let cid_commitment = poseidon2::bn254::hash_1([cid_leaf]);

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

    // Should fail: wrong_password doesn't hash to expected_hash
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
        cid_commitment,
    );
}

#[test(should_fail)]
fn test_wrong_cid_fails() {
    let password: [u8; 32] = [1; 32];
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];

    let real_cid: Field = 111;
    let fake_cid: Field = 999;
    let fake_cid_bytes: [u8; 32] = fake_cid.to_be_bytes::<32>();

    // Commitment for fake_cid (will pass commitment check but fail merkle)
    let cid_commitment = poseidon2::bn254::hash_1([fake_cid]);

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

    // Should fail: fake_cid doesn't produce merkle_root
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
        cid_commitment,
    );
}

#[test(should_fail)]
fn test_wrong_commitment_fails() {
    let password: [u8; 32] = [1; 32];
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];

    let cid_leaf: Field = 12345;
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    // Wrong commitment (for a different CID)
    let wrong_cid_commitment = poseidon2::bn254::hash_1([99999]);

    let merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH];

    let mut current = cid_leaf;
    for i in 0..TREE_DEPTH {
        current = poseidon2::bn254::hash_2([current, merkle_path[i]]);
    }
    let merkle_root = current;

    let mut nullifier_input: [u8; 128] = [0; 128];
    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = user_address[i];
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = cid_bytes[i];
    }
    let nullifier = std::hash::blake3(nullifier_input);

    // Should fail: wrong_cid_commitment doesn't match poseidon(cid_leaf)
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
        wrong_cid_commitment,
    );
}

#[test(should_fail)]
fn test_wrong_nullifier_fails() {
    let password: [u8; 32] = [1; 32];
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let vault_id: [u8; 32] = [3; 32];

    let cid_leaf: Field = 12345;

    let cid_commitment = poseidon2::bn254::hash_1([cid_leaf]);

    let merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH];

    let mut current = cid_leaf;
    for i in 0..TREE_DEPTH {
        current = poseidon2::bn254::hash_2([current, merkle_path[i]]);
    }
    let merkle_root = current;

    // Wrong nullifier (random bytes)
    let wrong_nullifier: [u8; 32] = [42; 32];

    // Should fail: nullifier doesn't match blake3(password || user || vault || cid)
    main(
        password,
        cid_leaf,
        merkle_path,
        merkle_indices,
        expected_hash,
        merkle_root,
        user_address,
        vault_id,
        wrong_nullifier,
        cid_commitment,
    );
}

#[test(should_fail)]
fn test_wrong_user_address_in_nullifier_fails() {
    let password: [u8; 32] = [1; 32];
    let expected_hash = keccak256(password, 32);

    let user_address: [u8; 32] = [2; 32];
    let wrong_user: [u8; 32] = [5; 32]; // Different user
    let vault_id: [u8; 32] = [3; 32];

    let cid_leaf: Field = 12345;
    let cid_bytes: [u8; 32] = cid_leaf.to_be_bytes::<32>();

    let cid_commitment = poseidon2::bn254::hash_1([cid_leaf]);

    let merkle_path: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let merkle_indices: [Field; TREE_DEPTH] = [0; TREE_DEPTH];

    let mut current = cid_leaf;
    for i in 0..TREE_DEPTH {
        current = poseidon2::bn254::hash_2([current, merkle_path[i]]);
    }
    let merkle_root = current;

    // Nullifier computed with wrong_user
    let mut nullifier_input: [u8; 128] = [0; 128];
    for i in 0..32 {
        nullifier_input[i] = password[i];
        nullifier_input[i + 32] = wrong_user[i]; // Wrong user!
        nullifier_input[i + 64] = vault_id[i];
        nullifier_input[i + 96] = cid_bytes[i];
    }
    let nullifier = std::hash::blake3(nullifier_input);

    // Should fail: nullifier was computed with wrong_user but we pass user_address
    main(
        password,
        cid_leaf,
        merkle_path,
        merkle_indices,
        expected_hash,
        merkle_root,
        user_address, // Correct user passed to circuit
        vault_id,
        nullifier, // But nullifier computed with wrong user
        cid_commitment,
    );
}