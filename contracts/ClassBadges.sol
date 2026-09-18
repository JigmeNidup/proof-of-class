// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ClassBadges
 * @notice Two-tier achievement badges for a classroom, as ERC-1155.
 *
 * ERC-1155 rather than ERC-721 because a trainee can top the leaderboard many
 * times: the badge tier is the token id and the win count is the balance, so
 * the UI reads one balance instead of enumerating N unique tokens.
 *
 * Tier 1 (WEEKLY_BADGE)  - hexagon, cyan.
 * Tier 2 (MONTHLY_BADGE) - eight-pointed star, gold. Outranks weekly.
 *
 * Metadata is served by the Next.js app at `<baseURI><id>`, which renders the
 * shape and colour per tier.
 */
contract ClassBadges is ERC1155, Ownable {
    using Strings for uint256;

    uint256 public constant WEEKLY_BADGE = 1;
    uint256 public constant MONTHLY_BADGE = 2;

    string public name;
    string public symbol;

    string private _baseTokenURI;

    event BadgeAwarded(
        address indexed to,
        uint256 indexed tokenId,
        uint256 quantity,
        string periodKey
    );
    event BaseURIUpdated(string baseURI);

    error UnknownBadge(uint256 tokenId);
    error ZeroRecipient();
    error ZeroQuantity();
    error ArrayLengthMismatch(uint256 recipients, uint256 quantities);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address initialOwner
    ) ERC1155(baseURI_) Ownable(initialOwner) {
        name = name_;
        symbol = symbol_;
        _baseTokenURI = baseURI_;
    }

    /**
     * @notice Mint `quantity` of a badge tier to a winner.
     * @param periodKey "2026-W35" for weekly, "2026-08" for monthly. Emitted so
     *        the indexer can tie the badge back to the period it was won in.
     */
    function awardBadge(
        address to,
        uint256 tokenId,
        uint256 quantity,
        string calldata periodKey
    ) external onlyOwner {
        _awardBadge(to, tokenId, quantity, periodKey);
    }

    function awardWeekly(
        address to,
        string calldata periodKey
    ) external onlyOwner {
        _awardBadge(to, WEEKLY_BADGE, 1, periodKey);
    }

    function awardMonthly(
        address to,
        string calldata periodKey
    ) external onlyOwner {
        _awardBadge(to, MONTHLY_BADGE, 1, periodKey);
    }

    /// @notice Airdrop one badge tier to several winners at once.
    function airdropBadge(
        address[] calldata recipients,
        uint256 tokenId,
        uint256[] calldata quantities,
        string calldata periodKey
    ) external onlyOwner {
        if (recipients.length != quantities.length) {
            revert ArrayLengthMismatch(recipients.length, quantities.length);
        }
        for (uint256 i = 0; i < recipients.length; ++i) {
            _awardBadge(recipients[i], tokenId, quantities[i], periodKey);
        }
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        _setURI(baseURI_);
        emit BaseURIUpdated(baseURI_);
    }

    /// @dev ERC-1155 allows `{id}` substitution, but most wallets handle a
    ///      fully expanded URI more reliably.
    function uri(
        uint256 tokenId
    ) public view override returns (string memory) {
        if (tokenId != WEEKLY_BADGE && tokenId != MONTHLY_BADGE) {
            revert UnknownBadge(tokenId);
        }
        return string.concat(_baseTokenURI, tokenId.toString());
    }

    function _awardBadge(
        address to,
        uint256 tokenId,
        uint256 quantity,
        string calldata periodKey
    ) private {
        if (to == address(0)) revert ZeroRecipient();
        if (quantity == 0) revert ZeroQuantity();
        if (tokenId != WEEKLY_BADGE && tokenId != MONTHLY_BADGE) {
            revert UnknownBadge(tokenId);
        }

        _mint(to, tokenId, quantity, "");
        emit BadgeAwarded(to, tokenId, quantity, periodKey);
    }
}
