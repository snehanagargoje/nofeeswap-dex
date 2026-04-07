/**
 * scripts/03_deploy_tokens.js
 *
 * Deploys two mock ERC-20 tokens (TOKEN_A and TOKEN_B) and mints
 * 10,000 of each to the deployer (test wallet).
 *
 * Also approves the NoFeeSwap core and operator contracts so they
 * can transfer tokens on behalf of the test wallet.
 *
 * Usage:
 *   npx hardhat run scripts/03_deploy_tokens.js --network localhost
 */

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

const ADDRESSES_PATH = path.join(__dirname, "../dapp/src/lib/addresses.json");

function readAddresses() {
  try { return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")); }
  catch { return {}; }
}
function writeAddresses(obj) {
  fs.mkdirSync(path.dirname(ADDRESSES_PATH), { recursive: true });
  fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(obj, null, 2));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses  = readAddresses();

  // -----------------------------------------------------------------------
  // Deploy TOKEN_A and TOKEN_B
  // -----------------------------------------------------------------------
  console.log("\nDeploying MockERC20 — TOKEN_A …");
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const tokenA = await MockERC20.deploy("Token Alpha", "TOKA", 18, deployer.address);
  await tokenA.waitForDeployment();
  console.log(`  TOKEN_A → ${await tokenA.getAddress()}`);

  console.log("Deploying MockERC20 — TOKEN_B …");
  const tokenB = await MockERC20.deploy("Token Beta", "TOKB", 18, deployer.address);
  await tokenB.waitForDeployment();
  console.log(`  TOKEN_B → ${await tokenB.getAddress()}`);

  // -----------------------------------------------------------------------
  // Mint 10,000 of each to the test wallet
  // -----------------------------------------------------------------------
  const MINT_AMOUNT = ethers.parseEther("10000");

  console.log("\nMinting 10,000 TOKEN_A to deployer …");
  await (await tokenA.mint(deployer.address, MINT_AMOUNT)).wait();

  console.log("Minting 10,000 TOKEN_B to deployer …");
  await (await tokenB.mint(deployer.address, MINT_AMOUNT)).wait();

  console.log(
    `\nDeployer balances:\n` +
    `  TOKEN_A: ${ethers.formatEther(await tokenA.balanceOf(deployer.address))}\n` +
    `  TOKEN_B: ${ethers.formatEther(await tokenB.balanceOf(deployer.address))}`
  );

  // -----------------------------------------------------------------------
  // Approve core + operator for max allowance
  // -----------------------------------------------------------------------
  const MAX = ethers.MaxUint256;

  for (const spender of [addresses.core, addresses.operator].filter(Boolean)) {
    console.log(`\nApproving ${spender} for TOKEN_A …`);
    await (await tokenA.approve(spender, MAX)).wait();
    console.log(`Approving ${spender} for TOKEN_B …`);
    await (await tokenB.approve(spender, MAX)).wait();
  }

  // -----------------------------------------------------------------------
  // Persist — ensure token0 < token1 (address ordering matters for poolId)
  // -----------------------------------------------------------------------
  const addrA = await tokenA.getAddress();
  const addrB = await tokenB.getAddress();

  const [token0Addr, token1Addr] =
    BigInt(addrA) < BigInt(addrB) ? [addrA, addrB] : [addrB, addrA];

  addresses.tokenA  = addrA;
  addresses.tokenB  = addrB;
  addresses.token0  = token0Addr;  // sorted
  addresses.token1  = token1Addr;  // sorted
  writeAddresses(addresses);

  console.log("\n✅ Token deployment & minting complete.");
  return { tokenA, tokenB };
}

module.exports = main;
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
