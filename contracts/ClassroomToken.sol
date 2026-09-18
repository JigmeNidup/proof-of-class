// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClassroomToken
 * @notice Reward points for a single classroom. The trainer's wallet is the
 *         owner and the only minter.
 *
 * Points are minted straight to the trainee rather than transferred from a
 * trainer-held supply, so a trainer never has to pre-fund a treasury.
 *
 * `awardPoints` carries the reward category and a note in its event. Keeping
 * them on-chain means the indexer can rebuild the full award history from logs
 * alone, without trusting whatever the browser posted to the API.
 */
contract ClassroomToken is ERC20, Ownable {
    /// @dev Mirrors the PointCategory enum in prisma/schema.prisma.
    uint8 public constant CATEGORY_CLASS = 0;
    uint8 public constant CATEGORY_PROJECT = 1;
    uint8 public constant CATEGORY_PUBLIC_VOTE = 2;
    uint8 private constant MAX_CATEGORY = 2;

    event PointsAwarded(
        address indexed to,
        uint256 amount,
        uint8 indexed category,
        string note
    );

    error InvalidCategory(uint8 category);
    error ArrayLengthMismatch(uint256 recipients, uint256 amounts);
    error ZeroRecipient();
    error ZeroAmount();

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {}

    /**
     * @notice Mint `amount` points to `to` under a reward category.
     * @param category One of CATEGORY_CLASS, CATEGORY_PROJECT, CATEGORY_PUBLIC_VOTE.
     * @param note Free-text reason shown in the trainee's history.
     */
    function awardPoints(
        address to,
        uint256 amount,
        uint8 category,
        string calldata note
    ) external onlyOwner {
        _award(to, amount, category, note);
    }

    /// @notice Award the same category to many trainees in one transaction.
    function batchAwardPoints(
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint8 category,
        string calldata note
    ) external onlyOwner {
        if (recipients.length != amounts.length) {
            revert ArrayLengthMismatch(recipients.length, amounts.length);
        }
        for (uint256 i = 0; i < recipients.length; ++i) {
            _award(recipients[i], amounts[i], category, note);
        }
    }

    function _award(
        address to,
        uint256 amount,
        uint8 category,
        string calldata note
    ) private {
        if (to == address(0)) revert ZeroRecipient();
        if (amount == 0) revert ZeroAmount();
        if (category > MAX_CATEGORY) revert InvalidCategory(category);

        _mint(to, amount);
        emit PointsAwarded(to, amount, category, note);
    }
}
