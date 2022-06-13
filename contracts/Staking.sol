// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;

    uint256 private constant THREE_MONTHS = 91 days;
    uint256 private constant SIX_MONTHS = 182 days;
    uint256 private constant ONE_YEAR = 365 days;

    mapping(address => StakingInfo) public stakingDetails;

    event Stake(address indexed staker, uint256 amount);
    event Unstake(address indexed staker, uint256 amount);
    event ClaimRewards(address indexed staker, uint256 amount);
    event Recovered(address indexed withdrawer, uint256 amount);

    struct StakingInfo {
        uint256 stakedAt;
        uint256 stakedTokens;
    }

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    function stake(uint256 _amount) external {
        require(_amount != 0, "stake: amount cannot be 0");

        StakingInfo storage stakingInfo = stakingDetails[msg.sender];
        require(stakingInfo.stakedTokens == 0, "stake: Already staked");

        stakingInfo.stakedTokens = _amount;
        stakingInfo.stakedAt = block.timestamp;

        emit Stake(msg.sender, _amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function unstake() external nonReentrant {
        StakingInfo storage stakingInfo = stakingDetails[msg.sender];
        require(stakingInfo.stakedTokens != 0, "unstake: amount cannot be 0");

        uint256 _amount = stakingInfo.stakedTokens;

        _claimReward();
        delete stakingDetails[msg.sender];

        emit Unstake(msg.sender, _amount);
        stakingToken.safeTransfer(msg.sender, _amount);
    }

    function recoverRewards(uint256 _amount) external onlyOwner {
        require(_amount != 0, "recoverRewards: Amount == 0");

        emit Recovered(msg.sender, _amount);
        rewardToken.safeTransfer(msg.sender, _amount);
    }

    function claimReward() external nonReentrant {
        _claimReward();
    }

    function viewReward(address _account)
        external
        view
        returns (uint256 rewardAmount)
    {
        require(_account != address(0), "viewReward: Zero address");
        return calculateReward(_account);
    }

    function _claimReward() internal {
        StakingInfo storage stakingInfo = stakingDetails[msg.sender];
        uint256 rewards = calculateReward(msg.sender);

        stakingInfo.stakedAt = block.timestamp;

        emit ClaimRewards(msg.sender, rewards);
        rewardToken.safeTransfer(msg.sender, rewards);
    }

    // function calculateReward(address _staker)
    //     internal
    //     view
    //     returns (uint256 rewards)
    // {
    //     StakingInfo memory stakingInfo = stakingDetails[_staker];

    //     if (block.timestamp - stakingInfo.stakedAt <= THREE_MONTHS) {
    //         rewards = (stakingInfo.stakedTokens * 5) / 100;
    //     }

    //     if (
    //         block.timestamp - stakingInfo.stakedAt > THREE_MONTHS &&
    //         block.timestamp - stakingInfo.stakedAt <= SIX_MONTHS
    //     ) {
    //         rewards = (stakingInfo.stakedTokens * 10) / 100;
    //     }

    //     if (
    //         block.timestamp - stakingInfo.stakedAt > SIX_MONTHS &&
    //         block.timestamp - stakingInfo.stakedAt <= ONE_YEAR
    //     ) {
    //         rewards = (stakingInfo.stakedTokens * 15) / 100;
    //     }

    //     if (block.timestamp - stakingInfo.stakedAt > ONE_YEAR) {
    //         rewards = (stakingInfo.stakedTokens * 15) / 100;
    //     }
    // }

    function calculateReward(address _staker)
        internal
        view
        returns (uint256 rewards)
    {
        StakingInfo memory stakingInfo = stakingDetails[_staker];

        if (
            block.timestamp - stakingInfo.stakedAt >= THREE_MONTHS &&
            block.timestamp - stakingInfo.stakedAt < SIX_MONTHS
        ) {
            rewards = (stakingInfo.stakedTokens * 5) / 100;
        }

        if (
            block.timestamp - stakingInfo.stakedAt >= SIX_MONTHS &&
            block.timestamp - stakingInfo.stakedAt < ONE_YEAR
        ) {
            rewards = (stakingInfo.stakedTokens * 10) / 100;
        }

        if (block.timestamp - stakingInfo.stakedAt >= ONE_YEAR) {
            rewards = (stakingInfo.stakedTokens * 15) / 100;
        }
    }
}
