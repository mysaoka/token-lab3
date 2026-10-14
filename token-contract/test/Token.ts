import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { zeroAddress, maxUint256 } from "viem";
describe("Token", async function () {
  const { viem } = await network.create();
  const client = await viem.getPublicClient();
  const [creator, other, third] = await viem.getWalletClients();
  const supply = 10000n * 10n ** 18n;
  const deploy = () => viem.deployContract("Token", ["HelloToken", "HELLO", supply]);
  it("Constructor assigns supply and emits Transfer from zero", async () => {
    const token = await deploy();
    assert.equal(await token.read.balanceOf([creator.account.address]), supply);
    assert.equal(await token.read.totalSupply(), supply);
    const events = await client.getContractEvents({address:token.address, abi:token.abi, eventName:"Transfer", fromBlock:await client.getBlockNumber(), strict:true});
    assert.equal(events.length, 1);
    assert.equal(events[0].args.from, zeroAddress);
    assert.equal(events[0].args.to.toLowerCase(), creator.account.address.toLowerCase());
    assert.equal(events[0].args.value, supply);
  });
  it("Only owner mints; balances, supply and event match", async () => {
    const token = await deploy();
    const amount = 10n * 10n ** 18n;
    await viem.assertions.emitWithArgs(token.write.mint([other.account.address, amount]), token, "Transfer", [zeroAddress, other.account.address, amount]);
    assert.equal(await token.read.balanceOf([other.account.address]), amount);
    assert.equal(await token.read.totalSupply(), supply + amount);
    await viem.assertions.revertWith(token.write.mint([other.account.address, amount], {account:other.account}), "Ownable: caller is not the owner");
    assert.equal(await token.read.totalSupply(), supply + amount);
  });
  it("Ownership transfer moves mint permission", async () => {
    const token = await deploy();
    await viem.assertions.revertWith(token.write.transferOwnership([other.account.address], {account:other.account}), "Ownable: caller is not the owner");
    await token.write.transferOwnership([other.account.address]);
    assert.equal((await token.read.owner()).toLowerCase(), other.account.address.toLowerCase());
    await viem.assertions.revertWith(token.write.mint([creator.account.address, 1n]), "Ownable: caller is not the owner");
    await token.write.mint([third.account.address, 1n], {account:other.account});
    assert.equal(await token.read.balanceOf([third.account.address]), 1n);
  });
  it("Transfer preserves supply; insufficient funds and zero recipient revert", async () => {
    const token = await deploy();
    await token.write.transfer([other.account.address, 123n]);
    assert.equal(await token.read.balanceOf([other.account.address]), 123n);
    assert.equal(await token.read.balanceOf([creator.account.address]), supply - 123n);
    assert.equal(await token.read.totalSupply(), supply);
    await viem.assertions.revertWith(token.write.transfer([other.account.address, supply]), "ERC20: transfer amount exceeds balance");
    await viem.assertions.revertWith(token.write.transfer([zeroAddress, 1n]), "ERC20: transfer to the zero address");
  });
  it("Delegated transfer consumes allowance; unlimited allowance stays unchanged", async () => {
    const token = await deploy();
    await token.write.approve([other.account.address, 20n]);
    await token.write.transferFrom([creator.account.address, third.account.address, 7n], {account:other.account});
    assert.equal(await token.read.allowance([creator.account.address, other.account.address]), 13n);
    assert.equal(await token.read.balanceOf([third.account.address]), 7n);
    await viem.assertions.revertWith(token.write.transferFrom([creator.account.address, third.account.address, 14n], {account:other.account}), "ERC20: insufficient allowance");
    await token.write.approve([other.account.address, maxUint256]);
    await token.write.transferFrom([creator.account.address, third.account.address, 1n], {account:other.account});
    assert.equal(await token.read.allowance([creator.account.address, other.account.address]), maxUint256);
  });
});
