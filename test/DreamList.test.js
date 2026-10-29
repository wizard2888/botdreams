const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DreamList", function () {
  let wl, alice, bob;

  beforeEach(async function () {
    [alice, bob] = await ethers.getSigners();
    wl = await (await ethers.getContractFactory("DreamList")).deploy();
    await wl.waitForDeployment();
  });

  describe("adding dreams", function () {
    it("stores the dream with the right defaults and emits an event", async function () {
      const tx = await wl.connect(alice).addDream("A good pair of headphones");
      const block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
      await expect(tx).to.emit(wl, "DreamAdded").withArgs(alice.address, 0n, "A good pair of headphones");

      const list = await wl.getDreams(alice.address);
      expect(list.length).to.equal(1);
      expect(list[0].text).to.equal("A good pair of headphones");
      expect(list[0].achieved).to.equal(false);
      expect(list[0].removed).to.equal(false);
      expect(list[0].createdAt).to.equal(BigInt(block.timestamp));
      expect(await wl.dreamCount(alice.address)).to.equal(1n);
    });

    it("gives sequential ids and keeps order", async function () {
      await wl.connect(alice).addDream("first");
      await wl.connect(alice).addDream("second");
      await wl.connect(alice).addDream("third");
      const list = await wl.getDreams(alice.address);
      expect(list.map((w) => w.text)).to.deep.equal(["first", "second", "third"]);
    });

    it("rejects an empty dream", async function () {
      await expect(wl.connect(alice).addDream("")).to.be.revertedWith("Dream cannot be empty");
    });

    it("accepts the maximum length and rejects one byte more", async function () {
      await expect(wl.connect(alice).addDream("a".repeat(420))).to.not.be.reverted;
      await expect(wl.connect(alice).addDream("a".repeat(421))).to.be.revertedWith("Dream is too long");
    });

    it("measures length in bytes: 140 three-byte characters fit, 141 do not", async function () {
      // the website allows 140 characters; 420 bytes covers the worst case for accents and symbols
      await expect(wl.connect(alice).addDream("€".repeat(140))).to.not.be.reverted;
      await expect(wl.connect(alice).addDream("€".repeat(141))).to.be.revertedWith("Dream is too long");
    });

    it("stores emoji and non-English text faithfully", async function () {
      await wl.connect(alice).addDream("Pasear en bicicleta 🚲 東京");
      expect((await wl.getDreams(alice.address))[0].text).to.equal("Pasear en bicicleta 🚲 東京");
    });

    it("stops at the per-wallet cap of 1000 entries", async function () {
      this.timeout(180000);
      for (let i = 0; i < 1000; i++) await wl.connect(alice).addDream("w" + i);
      expect(await wl.dreamCount(alice.address)).to.equal(1000n);
      await expect(wl.connect(alice).addDream("one too many")).to.be.revertedWith("Dream list is full");
      // the cap is per wallet
      await expect(wl.connect(bob).addDream("still fine for bob")).to.not.be.reverted;
    });
  });

  describe("marking achieved", function () {
    beforeEach(async function () {
      await wl.connect(alice).addDream("one");
      await wl.connect(alice).addDream("two");
    });

    it("sets and unsets the flag, emitting an event each time", async function () {
      await expect(wl.connect(alice).setAchieved(1, true)).to.emit(wl, "DreamAchievedSet").withArgs(alice.address, 1n, true);
      let list = await wl.getDreams(alice.address);
      expect(list[1].achieved).to.equal(true);
      expect(list[0].achieved).to.equal(false);

      await expect(wl.connect(alice).setAchieved(1, false)).to.emit(wl, "DreamAchievedSet").withArgs(alice.address, 1n, false);
      list = await wl.getDreams(alice.address);
      expect(list[1].achieved).to.equal(false);
    });

    it("rejects an id that doesn't exist", async function () {
      await expect(wl.connect(alice).setAchieved(2, true)).to.be.revertedWith("No such dream");
    });
  });

  describe("removing", function () {
    beforeEach(async function () {
      await wl.connect(alice).addDream("keep me");
      await wl.connect(alice).addDream("remove me");
      await wl.connect(alice).addDream("keep me too");
    });

    it("clears the text, flags the entry, and emits an event", async function () {
      await expect(wl.connect(alice).removeDream(1)).to.emit(wl, "DreamRemoved").withArgs(alice.address, 1n);
      const list = await wl.getDreams(alice.address);
      expect(list[1].removed).to.equal(true);
      expect(list[1].text).to.equal("");
    });

    it("keeps every other dream and its id unchanged", async function () {
      await wl.connect(alice).removeDream(1);
      const list = await wl.getDreams(alice.address);
      expect(list.length).to.equal(3);
      expect(list[0].text).to.equal("keep me");
      expect(list[2].text).to.equal("keep me too");
      // ids are stable, so the surviving dreams can still be edited by their original ids
      await expect(wl.connect(alice).setAchieved(2, true)).to.not.be.reverted;
    });

    it("a removed dream can't be removed or changed again", async function () {
      await wl.connect(alice).removeDream(1);
      await expect(wl.connect(alice).removeDream(1)).to.be.revertedWith("Dream was removed");
      await expect(wl.connect(alice).setAchieved(1, true)).to.be.revertedWith("Dream was removed");
    });

    it("rejects an id that doesn't exist", async function () {
      await expect(wl.connect(alice).removeDream(9)).to.be.revertedWith("No such dream");
    });

    it("removed entries still count toward the lifetime cap and new dreams get new ids", async function () {
      await wl.connect(alice).removeDream(0);
      await wl.connect(alice).addDream("a new one");
      const list = await wl.getDreams(alice.address);
      expect(list.length).to.equal(4);
      expect(list[3].text).to.equal("a new one");
    });
  });

  describe("every wallet has its own list", function () {
    it("one wallet's dreams never appear in another's", async function () {
      await wl.connect(alice).addDream("alice's dream");
      await wl.connect(bob).addDream("bob's dream");
      expect((await wl.getDreams(alice.address)).map((w) => w.text)).to.deep.equal(["alice's dream"]);
      expect((await wl.getDreams(bob.address)).map((w) => w.text)).to.deep.equal(["bob's dream"]);
    });

    it("nobody can touch another wallet's dreams: writes only ever act on the caller's own list", async function () {
      await wl.connect(alice).addDream("alice's dream");
      // bob has no dreams, so id 0 doesn't exist in HIS list, even though it does in alice's
      await expect(wl.connect(bob).setAchieved(0, true)).to.be.revertedWith("No such dream");
      await expect(wl.connect(bob).removeDream(0)).to.be.revertedWith("No such dream");
      const alices = await wl.getDreams(alice.address);
      expect(alices[0].achieved).to.equal(false);
      expect(alices[0].removed).to.equal(false);
    });

    it("anyone can read any list", async function () {
      await wl.connect(alice).addDream("public by design");
      const seenByBob = await wl.connect(bob).getDreams(alice.address);
      expect(seenByBob[0].text).to.equal("public by design");
    });

    it("an address with no dreams returns an empty list", async function () {
      expect(await wl.dreamCount(bob.address)).to.equal(0n);
      expect((await wl.getDreams(bob.address)).length).to.equal(0);
    });
  });

  describe("structural guarantees", function () {
    it("holds no funds: plain transfers and calls with data both revert", async function () {
      const addr = await wl.getAddress();
      await expect(alice.sendTransaction({ to: addr, value: 1n })).to.be.reverted;
      await expect(alice.sendTransaction({ to: addr, value: 1n, data: "0x1234" })).to.be.reverted;
      expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    });

    it("has no payable function", async function () {
      expect(wl.interface.fragments.filter((f) => f.type === "function" && f.payable).length).to.equal(0);
    });

    it("exposes exactly the expected functions: no owner, admin, or upgrade hooks exist", async function () {
      const names = wl.interface.fragments.filter((f) => f.type === "function").map((f) => f.name).sort();
      expect(names).to.deep.equal(["MAX_DREAMS", "MAX_TEXT_BYTES", "addDream", "dreamCount", "getDreams", "removeDream", "setAchieved"]);
    });
  });
});
