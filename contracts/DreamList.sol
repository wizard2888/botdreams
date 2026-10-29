// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DreamList
/// @notice A simple dream list for every wallet. Add a dream, mark it achieved, remove it.
///
/// @dev DESIGN NOTES
///      - Each wallet only ever touches its own list: every write acts on msg.sender's dreams,
///        so there is no owner, no admin, and no way for anyone to edit someone else's list.
///      - Holds no funds. Nothing is payable and there is no receive/fallback, so sending BOT to
///        this contract reverts. It is free to use apart from network gas.
///      - EVERYTHING HERE IS PUBLIC. Anyone can read any wallet's list. "Removing" a dream clears
///        its text from contract storage and hides it from the list, but the text was already
///        recorded in transaction data and event logs, and that history cannot be erased.
///      - Removed dreams keep their slot (marked removed) so dream ids never change.
contract DreamList {
    uint256 public constant MAX_TEXT_BYTES = 420; // the website limits dreams to 140 characters; 420 bytes leaves room for accents and emoji
    uint256 public constant MAX_DREAMS = 1000;    // lifetime entries per wallet, counting removed ones

    struct Dream {
        string text;
        bool achieved;
        bool removed;
        uint64 createdAt;
    }

    mapping(address => Dream[]) private _dreams;

    event DreamAdded(address indexed owner, uint256 indexed id, string text);
    event DreamAchievedSet(address indexed owner, uint256 indexed id, bool achieved);
    event DreamRemoved(address indexed owner, uint256 indexed id);

    function addDream(string calldata text) external returns (uint256 id) {
        uint256 len = bytes(text).length;
        require(len > 0, "Dream cannot be empty");
        require(len <= MAX_TEXT_BYTES, "Dream is too long");
        require(_dreams[msg.sender].length < MAX_DREAMS, "Dream list is full");

        id = _dreams[msg.sender].length;
        _dreams[msg.sender].push(Dream({text: text, achieved: false, removed: false, createdAt: uint64(block.timestamp)}));
        emit DreamAdded(msg.sender, id, text);
    }

    function setAchieved(uint256 id, bool achieved) external {
        Dream storage w = _liveDream(msg.sender, id);
        w.achieved = achieved;
        emit DreamAchievedSet(msg.sender, id, achieved);
    }

    /// @notice Hide a dream and clear its text from storage. The original text remains in past
    ///         transaction data and event logs.
    function removeDream(uint256 id) external {
        Dream storage w = _liveDream(msg.sender, id);
        delete w.text;
        w.removed = true;
        emit DreamRemoved(msg.sender, id);
    }

    // --- Views (anyone can read any wallet's list) ---

    function dreamCount(address owner) external view returns (uint256) {
        return _dreams[owner].length;
    }

    /// @notice All entries for a wallet, in order. Removed entries are included (removed = true,
    ///         empty text) so that array index always equals dream id.
    function getDreams(address owner) external view returns (Dream[] memory) {
        return _dreams[owner];
    }

    function _liveDream(address owner, uint256 id) internal view returns (Dream storage w) {
        require(id < _dreams[owner].length, "No such dream");
        w = _dreams[owner][id];
        require(!w.removed, "Dream was removed");
    }
}
