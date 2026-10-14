import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
export default buildModule("KWNcoin", (m) => {
  const token = m.contract("Token", ["KWNcoin", "KWN", 100000n * 10n ** 18n]);
  const newOwner = m.getParameter("newOwner", m.getAccount(0));
  m.call(token, "transferOwnership", [newOwner]);
  return { token };
});
