// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ClassroomToken} from "./ClassroomToken.sol";
import {ClassBadges} from "./ClassBadges.sol";

/**
 * @title ClassroomFactory
 * @notice Deploys a points token and a badge collection for one classroom,
 *         owned by the trainer who called it.
 *
 * The platform never holds a minting key: `msg.sender` is passed straight
 * through as the owner of both contracts, so only the trainer's own wallet can
 * award points or badges.
 */
contract ClassroomFactory {
    struct Deployment {
        address trainer;
        address token;
        address badges;
        uint256 createdAt;
    }

    Deployment[] private _deployments;
    mapping(address trainer => uint256[] indexes) private _byTrainer;

    event ClassroomDeployed(
        address indexed trainer,
        address indexed token,
        address indexed badges,
        string name,
        string symbol,
        uint256 index
    );

    /**
     * @param name_ Display name, reused for both the ERC-20 and the badges.
     * @param symbol_ Ticker for the points token.
     * @param badgeBaseURI Absolute URL prefix, e.g.
     *        "https://host/api/metadata/badges/". The token id is appended.
     */
    function createClassroom(
        string calldata name_,
        string calldata symbol_,
        string calldata badgeBaseURI
    ) external returns (address token, address badges) {
        ClassroomToken deployedToken = new ClassroomToken(
            name_,
            symbol_,
            msg.sender
        );
        ClassBadges deployedBadges = new ClassBadges(
            string.concat(name_, " Badges"),
            string.concat(symbol_, "B"),
            badgeBaseURI,
            msg.sender
        );

        token = address(deployedToken);
        badges = address(deployedBadges);

        uint256 index = _deployments.length;
        _deployments.push(
            Deployment({
                trainer: msg.sender,
                token: token,
                badges: badges,
                createdAt: block.timestamp
            })
        );
        _byTrainer[msg.sender].push(index);

        emit ClassroomDeployed(msg.sender, token, badges, name_, symbol_, index);
    }

    function deploymentCount() external view returns (uint256) {
        return _deployments.length;
    }

    function deploymentAt(
        uint256 index
    ) external view returns (Deployment memory) {
        return _deployments[index];
    }

    function deploymentsOf(
        address trainer
    ) external view returns (Deployment[] memory result) {
        uint256[] storage indexes = _byTrainer[trainer];
        result = new Deployment[](indexes.length);
        for (uint256 i = 0; i < indexes.length; ++i) {
            result[i] = _deployments[indexes[i]];
        }
    }
}
