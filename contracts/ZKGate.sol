// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.21;

interface IVerifier {
	function verify(
		bytes calldata _proof,
		bytes32[] calldata _publicInputs
	) external view returns (bool);
}

contract ZKGate {
	// vaultId => user => hasAccess
	mapping(bytes32 => mapping(address => bool)) public hasAccess;

	// vaultId => owner
	mapping(bytes32 => address) public vaultOwner;

	// vaultId => passwordHash
	mapping(bytes32 => bytes32) public vaultPasswordHash;

	// vaultId => array of entries
	mapping(bytes32 => VaultEntry[]) public vaultEntries;

	// nullifier => spent
	mapping(bytes32 => bool) public spentNullifiers;

	struct VaultEntry {
		string cid;
		string tag;
		StorageProvider provider;
		uint256 createdAt;
	}

	enum StorageProvider {
		Storacha,
		Pinata,
		IPFS,
		Other
	}

	IVerifier public verifier;
	address public treasury;
	uint256 public vaultCreationFee;

	event VaultCreated(bytes32 indexed vaultId, address indexed owner);
	event EntryAdded(
		bytes32 indexed vaultId,
		uint256 indexed entryIndex,
		string cid,
		string tag,
		StorageProvider provider
	);
	event EntryRemoved(bytes32 indexed vaultId, uint256 indexed entryIndex);
	event AccessGranted(bytes32 indexed vaultId, address indexed user);
	event FeesReaped(address indexed reaper, uint256 amount);

	constructor(
		address _verifier,
		address _treasury,
		uint256 _vaultCreationFee
	) {
		verifier = IVerifier(_verifier);
		treasury = _treasury;
		vaultCreationFee = _vaultCreationFee;
	}

	// Create an empty vault
	function createVault(
		bytes32 passwordHash
	) external payable returns (bytes32 vaultId) {
		vaultId = keccak256(abi.encode(passwordHash, msg.sender));

		require(msg.value >= vaultCreationFee, "Insufficient fee");
		require(vaultPasswordHash[vaultId] == bytes32(0), "Vault exists");

		vaultPasswordHash[vaultId] = passwordHash;
		vaultOwner[vaultId] = msg.sender;

		// Refund excess
		if (msg.value > vaultCreationFee) {
			payable(msg.sender).transfer(msg.value - vaultCreationFee);
		}

		emit VaultCreated(vaultId, msg.sender);
		return vaultId;
	}

	// Add entry to vault (owner only)
	function addEntry(
		bytes32 vaultId,
		string calldata cid,
		string calldata tag,
		StorageProvider provider
	) external returns (uint256 entryIndex) {
		require(vaultOwner[vaultId] == msg.sender, "Not owner");
		require(bytes(cid).length > 0, "CID required");

		entryIndex = vaultEntries[vaultId].length;

		vaultEntries[vaultId].push(
			VaultEntry({
				cid: cid,
				tag: tag,
				provider: provider,
				createdAt: block.timestamp
			})
		);

		emit EntryAdded(vaultId, entryIndex, cid, tag, provider);
		return entryIndex;
	}

	// Remove entry (owner only) - sets to empty, doesn't shift array
	function removeEntry(bytes32 vaultId, uint256 entryIndex) external {
		require(vaultOwner[vaultId] == msg.sender, "Not owner");
		require(entryIndex < vaultEntries[vaultId].length, "Invalid index");

		delete vaultEntries[vaultId][entryIndex];

		emit EntryRemoved(vaultId, entryIndex);
	}

	function submitProof(
		bytes32 vaultId,
		bytes32 nullifier,
		bytes calldata proof
	) external {
		// require(!spentNullifiers[nullifier], "Nullifier already spent");

		// bytes32 expectedHash = vaultPasswordHash[vaultId];
		// require(expectedHash != bytes32(0), "Vault not found");

		// bytes32 userAddress = bytes32(uint256(uint160(msg.sender)));

		// // 128 public inputs: 4 arrays × 32 bytes each
		// bytes32[] memory publicInputs = new bytes32[](128);

		
		// for (uint256 i = 0; i < 32; i++) {
        //     // expected_hash (indices 0-31)
		// 	publicInputs[i] = bytes32(uint256(uint8(expectedHash[i])));
        //     // user_address (indices 32-63)
        //     publicInputs[32 + i] = bytes32(uint256(uint8(userAddress[i])));
        //     // vault_id (indices 64-95)
        //     publicInputs[64 + i] = bytes32(uint256(uint8(vaultId[i])));
        //     // nullifier (indices 96-127)
        //     publicInputs[96 + i] = bytes32(uint256(uint8(nullifier[i])));
		// }

		// require(verifier.verify(proof, publicInputs), "Invalid proof");

		// spentNullifiers[nullifier] = true;
		hasAccess[vaultId][msg.sender] = true;

		emit AccessGranted(vaultId, msg.sender);
	}

	// View functions
	function checkAccess(
		bytes32 vaultId,
		address user
	) external view returns (bool) {
		return hasAccess[vaultId][user];
	}

	function getEntryCount(bytes32 vaultId) external view returns (uint256) {
		return vaultEntries[vaultId].length;
	}

	function getEntry(
		bytes32 vaultId,
		uint256 entryIndex
	)
		external
		view
		returns (
			string memory cid,
			string memory tag,
			StorageProvider provider,
			uint256 createdAt
		)
	{
		require(entryIndex < vaultEntries[vaultId].length, "Invalid index");
		VaultEntry memory entry = vaultEntries[vaultId][entryIndex];
		return (entry.cid, entry.tag, entry.provider, entry.createdAt);
	}

	// Get all entries (careful with gas on large vaults)
	function getAllEntries(
		bytes32 vaultId
	) external view returns (VaultEntry[] memory) {
		return vaultEntries[vaultId];
	}

	function revokeOwnAccess(bytes32 vaultId) external {
		hasAccess[vaultId][msg.sender] = false;
	}

	function reapFees() external {
		uint256 balance = address(this).balance;
		require(balance > 0, "Nothing to reap");

		payable(treasury).transfer(balance);

		emit FeesReaped(treasury, balance);
	}

	function setTreasury(address _treasury) external {
		require(msg.sender == treasury, "Only treasury");
		treasury = _treasury;
	}

	function setVaultCreationFee(uint256 _fee) external {
		require(msg.sender == treasury, "Only treasury");
		vaultCreationFee = _fee;
	}
}
