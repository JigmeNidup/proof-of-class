const { expect } = require("chai");
const { ethers } = require("hardhat");

const BADGE_BASE_URI = "http://localhost:3000/api/metadata/badges/";

describe("ProofOfClass contracts", function () {
  let trainer;
  let trainee;
  let outsider;

  beforeEach(async function () {
    [trainer, trainee, outsider] = await ethers.getSigners();
  });

  describe("ClassroomToken", function () {
    let token;

    beforeEach(async function () {
      const Token = await ethers.getContractFactory("ClassroomToken");
      token = await Token.deploy("Blockchain Foundations", "BFP", trainer.address);
      await token.waitForDeployment();
    });

    it("makes the supplied address the owner", async function () {
      expect(await token.owner()).to.equal(trainer.address);
    });

    it("mints points to a trainee and emits the category", async function () {
      const amount = ethers.parseEther("50");

      await expect(
        token.awardPoints(trainee.address, amount, 1, "Project milestone"),
      )
        .to.emit(token, "PointsAwarded")
        .withArgs(trainee.address, amount, 1, "Project milestone");

      expect(await token.balanceOf(trainee.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("rejects awards from anyone but the owner", async function () {
      await expect(
        token
          .connect(outsider)
          .awardPoints(outsider.address, ethers.parseEther("1"), 0, "nope"),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("rejects an unknown category", async function () {
      await expect(
        token.awardPoints(trainee.address, ethers.parseEther("1"), 7, "bad"),
      )
        .to.be.revertedWithCustomError(token, "InvalidCategory")
        .withArgs(7);
    });

    it("rejects zero amounts and the zero address", async function () {
      await expect(
        token.awardPoints(trainee.address, 0, 0, "empty"),
      ).to.be.revertedWithCustomError(token, "ZeroAmount");

      await expect(
        token.awardPoints(ethers.ZeroAddress, 1, 0, "nobody"),
      ).to.be.revertedWithCustomError(token, "ZeroRecipient");
    });

    it("awards a batch in one transaction", async function () {
      const amounts = [ethers.parseEther("10"), ethers.parseEther("20")];

      await token.batchAwardPoints(
        [trainee.address, outsider.address],
        amounts,
        2,
        "Public vote",
      );

      expect(await token.balanceOf(trainee.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(outsider.address)).to.equal(amounts[1]);
    });

    it("rejects mismatched batch arrays", async function () {
      await expect(
        token.batchAwardPoints([trainee.address], [1, 2], 0, "mismatch"),
      ).to.be.revertedWithCustomError(token, "ArrayLengthMismatch");
    });
  });

  describe("ClassBadges", function () {
    let badges;

    beforeEach(async function () {
      const Badges = await ethers.getContractFactory("ClassBadges");
      badges = await Badges.deploy(
        "Blockchain Foundations Badges",
        "BFPB",
        BADGE_BASE_URI,
        trainer.address,
      );
      await badges.waitForDeployment();
    });

    it("mints a weekly badge as token id 1", async function () {
      await expect(badges.awardWeekly(trainee.address, "2026-W35"))
        .to.emit(badges, "BadgeAwarded")
        .withArgs(trainee.address, 1n, 1n, "2026-W35");

      expect(await badges.balanceOf(trainee.address, 1)).to.equal(1n);
    });

    it("mints a monthly badge as token id 2", async function () {
      await badges.awardMonthly(trainee.address, "2026-08");
      expect(await badges.balanceOf(trainee.address, 2)).to.equal(1n);
    });

    it("accumulates repeat wins as balance rather than new token ids", async function () {
      await badges.awardWeekly(trainee.address, "2026-W35");
      await badges.awardWeekly(trainee.address, "2026-W36");
      await badges.awardWeekly(trainee.address, "2026-W37");

      expect(await badges.balanceOf(trainee.address, 1)).to.equal(3n);
    });

    it("rejects badge minting from a non-owner", async function () {
      await expect(
        badges.connect(outsider).awardWeekly(outsider.address, "2026-W35"),
      ).to.be.revertedWithCustomError(badges, "OwnableUnauthorizedAccount");
    });

    it("rejects unknown token ids", async function () {
      await expect(badges.awardBadge(trainee.address, 3, 1, "2026-W35"))
        .to.be.revertedWithCustomError(badges, "UnknownBadge")
        .withArgs(3);
    });

    it("builds a per-tier metadata uri", async function () {
      expect(await badges.uri(1)).to.equal(`${BADGE_BASE_URI}1`);
      expect(await badges.uri(2)).to.equal(`${BADGE_BASE_URI}2`);
    });

    it("airdrops one tier to several winners", async function () {
      await badges.airdropBadge(
        [trainee.address, outsider.address],
        2,
        [1, 2],
        "2026-08",
      );

      expect(await badges.balanceOf(trainee.address, 2)).to.equal(1n);
      expect(await badges.balanceOf(outsider.address, 2)).to.equal(2n);
    });
  });

  describe("ClassroomFactory", function () {
    let factory;

    beforeEach(async function () {
      const Factory = await ethers.getContractFactory("ClassroomFactory");
      factory = await Factory.deploy();
      await factory.waitForDeployment();
    });

    it("gives the caller ownership of both deployed contracts", async function () {
      await factory
        .connect(trainee)
        .createClassroom("Solidity 101", "S101", BADGE_BASE_URI);

      const deployments = await factory.deploymentsOf(trainee.address);
      expect(deployments).to.have.lengthOf(1);

      const token = await ethers.getContractAt(
        "ClassroomToken",
        deployments[0].token,
      );
      const badges = await ethers.getContractAt(
        "ClassBadges",
        deployments[0].badges,
      );

      expect(await token.owner()).to.equal(trainee.address);
      expect(await badges.owner()).to.equal(trainee.address);
      expect(await token.symbol()).to.equal("S101");
      expect(await badges.symbol()).to.equal("S101B");
    });

    it("lets the new owner award immediately and blocks the factory itself", async function () {
      await factory
        .connect(trainee)
        .createClassroom("Solidity 101", "S101", BADGE_BASE_URI);

      const [deployment] = await factory.deploymentsOf(trainee.address);
      const token = await ethers.getContractAt(
        "ClassroomToken",
        deployment.token,
      );

      await token
        .connect(trainee)
        .awardPoints(outsider.address, ethers.parseEther("5"), 0, "Attendance");

      expect(await token.balanceOf(outsider.address)).to.equal(
        ethers.parseEther("5"),
      );

      await expect(
        token
          .connect(trainer)
          .awardPoints(trainer.address, ethers.parseEther("5"), 0, "nope"),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("emits ClassroomDeployed and tracks the deployment index", async function () {
      await expect(
        factory.createClassroom("Cohort A", "CA", BADGE_BASE_URI),
      ).to.emit(factory, "ClassroomDeployed");

      expect(await factory.deploymentCount()).to.equal(1n);
      const deployment = await factory.deploymentAt(0);
      expect(deployment.trainer).to.equal(trainer.address);
    });
  });
});
