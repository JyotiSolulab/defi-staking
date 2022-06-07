const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { BigNumber } = ethers;

let Staking, staking, MockToken, stakingToken, rewardToken, addr1, owner;

const now = async () => {
  const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
  return timestamp;
};

const increaseTime = async (duration) => {
  await network.provider.send("evm_increaseTime", [duration]);
  await network.provider.send("evm_mine");
};

describe("Staking Contract", function () {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    [owner, addr1] = accounts;

    MockToken = await ethers.getContractFactory("MockToken");
    stakingToken = await MockToken.deploy();
    await stakingToken.deployed();

    rewardToken = await MockToken.deploy();
    await rewardToken.deployed();

    Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(stakingToken.address, rewardToken.address);
    await staking.deployed();

    await rewardToken
      .connect(owner)
      .transfer(
        staking.address,
        BigNumber.from(1000000000).mul(BigNumber.from(10).pow(18))
      );

    for (let index = 0; index < 5; index++) {
      const amount = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
      await stakingToken.transfer(accounts[index].address, amount);
      await stakingToken
        .connect(accounts[index])
        .approve(staking.address, amount);
    }
  });

  describe("Staking token", () => {
    it("Should fail if staking amount is 0", async () => {
      await expect(staking.connect(addr1).stake(0)).to.be.revertedWith(
        "stake: amount cannot be 0"
      );
    });

    it("Should successfully stake", async () => {
      const value = BigNumber.from(10).mul(BigNumber.from(10).pow(18));
      const stakingPromise = await staking.connect(addr1).stake(value);

      const stakingDetails = await staking.stakingDetails(addr1.address);

      expect(stakingPromise)
        .to.emit(staking, "Stake")
        .withArgs(addr1.address, value);

      expect(stakingDetails.stakedAt).to.be.equal(await now());
      expect(stakingDetails.stakedTokens).to.be.equal(value);
    });

    it("Should fail if the user has already staked", async () => {
      const value = BigNumber.from(10).mul(BigNumber.from(10).pow(18));
      await staking.connect(addr1).stake(value);
      await expect(staking.connect(addr1).stake(value)).to.be.revertedWith(
        "stake: Already staked"
      );
    });
  });

  describe("Unstaking token", () => {
    it("Should unstake the token and transfer the staking tokens back", async () => {
      const value = BigNumber.from(10).mul(BigNumber.from(10).pow(18));
      await staking.connect(addr1).stake(value);

      await expect(() =>
        staking.connect(addr1).unstake()
      ).to.changeTokenBalances(
        stakingToken,
        [addr1, staking],
        [value, value.mul("-1")]
      );
    });

    it("Should unstake the token and transfer the reward tokens", async () => {
      const value = BigNumber.from(10).mul(BigNumber.from(10).pow(18));
      await staking.connect(addr1).stake(value);

      await increaseTime(3 * 30 * 24 * 60 * 60);

      const rewards = await staking.viewReward(addr1.address);

      await expect(() =>
        staking.connect(addr1).unstake()
      ).to.changeTokenBalances(
        rewardToken,
        [addr1, staking],
        [rewards, rewards.mul("-1")]
      );
    });

    it("Should fail for unstaking 0 token", async () => {
      await expect(staking.connect(addr1).unstake()).to.be.revertedWith(
        "unstake: amount cannot be 0"
      );
    });
  });

  describe("Claiming Token", () => {
    it("Should claim reward for 3 months", async () => {
      const value = BigNumber.from(10).mul(BigNumber.from(10).pow(18));
      await staking.connect(addr1).stake(value);

      await increaseTime(2 * 30 * 24 * 60 * 60);

      const rewards = await staking.viewReward(addr1.address);

      await expect(() =>
        staking.connect(addr1).claimReward()
      ).to.changeTokenBalances(
        rewardToken,
        [addr1, staking],
        [rewards, rewards.mul("-1")]
      );
    });

    it("Should claim reward for 6 months", async () => {
      const value = BigNumber.from(10).mul(BigNumber.from(10).pow(18));
      await staking.connect(addr1).stake(value);

      await increaseTime(5 * 30 * 24 * 60 * 60);

      const rewards = await staking.viewReward(addr1.address);

      await expect(() =>
        staking.connect(addr1).claimReward()
      ).to.changeTokenBalances(
        rewardToken,
        [addr1, staking],
        [rewards, rewards.mul("-1")]
      );
    });

    it("Should claim reward for 1 year", async () => {
      const value = BigNumber.from(10).mul(BigNumber.from(10).pow(18));
      await staking.connect(addr1).stake(value);

      await increaseTime(9 * 30 * 24 * 60 * 60);

      const rewards = await staking.viewReward(addr1.address);

      await expect(() =>
        staking.connect(addr1).claimReward()
      ).to.changeTokenBalances(
        rewardToken,
        [addr1, staking],
        [rewards, rewards.mul("-1")]
      );
    });

    it("Should claim reward for more than 1 year", async () => {
      const value = BigNumber.from(10).mul(BigNumber.from(10).pow(18));
      await staking.connect(addr1).stake(value);

      await increaseTime(15 * 30 * 24 * 60 * 60);

      const rewards = await staking.viewReward(addr1.address);

      await expect(() =>
        staking.connect(addr1).claimReward()
      ).to.changeTokenBalances(
        rewardToken,
        [addr1, staking],
        [rewards, rewards.mul("-1")]
      );
    });
  });

  describe("Recovering token", () => {
    it("Should fail if unauthorized user recovers tokens", async () => {
      await expect(
        staking.connect(addr1).recoverRewards(10)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if recover amount is 0", async () => {
      await expect(staking.connect(owner).recoverRewards(0)).to.be.revertedWith(
        "recoverRewards: Amount == 0"
      );
    });

    it("Should recover token successfully", async () => {
      const contractBalance = await rewardToken.balanceOf(staking.address);

      // await expect(() => {
      //   staking.connect(owner).recoverRewards(contractBalance);
      // }).to.changeTokenBalances(
      //   rewardToken,
      //   [owner, staking],
      //   [contractBalance, contractBalance.mul("-1")]
      // );

      await staking.connect(owner).recoverRewards(contractBalance);

      expect(await rewardToken.balanceOf(owner.address)).to.be.equal(
        contractBalance
      );

      expect(await rewardToken.balanceOf(staking.address)).to.be.equal(0);
    });
  });
});
