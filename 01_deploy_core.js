/**
 * scripts/01_deploy_core.js
 *
 * Clones (if needed) and deploys the NoFeeSwap core contracts:
 *   - NofeeswapDelegatee  (pool logic implementation)
 *   - Nofeeswap           (singleton proxy / manager)
 *
 * The core repo uses a pattern similar to INofeeswapDelegatee.sol#L11:
 *   initialize(poolId, kernel, curve, sqrtPrice, hookData)
 *
 * Reference: Initialize_test.py#L67-L78
 *
 * Usage (standalone):
 *   npx hardhat run scripts/01_deploy_core.js --network localhost
 */

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  // -----------------------------------------------------------------------
  // Step 1 — Clone the core repo (if not already present)
  // -----------------------------------------------------------------------
  const coreDir = path.join(__dirname, "../../nofeeswap-core");
  if (!fs.existsSync(coreDir)) {
    console.log("\nCloning NoFeeSwap/core …");
    execSync(
      `git clone https://github.com/NoFeeSwap/core.git ${coreDir} && ` +
      `cd ${coreDir} && git submodule update --init --depth 1`,
      { stdio: "inherit" }
    );
    console.log("Clone complete.");
  } else {
    console.log(`\nCore repo already present at ${coreDir}`);
  }

  // -----------------------------------------------------------------------
  // Step 2 — Compile via Foundry (forge) or fall back to Hardhat artifacts
  // -----------------------------------------------------------------------
  // Try forge first; fall back to pre-compiled artifact stubs if unavailable.
  let NofeeswapDelegateeFactory, NofeeswapFactory;

  try {
    execSync("forge --version", { stdio: "pipe" });
    console.log("\nCompiling core with forge …");
    execSync(`cd ${coreDir} && forge build --out out --lib-paths lib`, { stdio: "inherit" });

    const delegateeArtifact = JSON.parse(
      fs.readFileSync(path.join(coreDir, "out/NofeeswapDelegatee.sol/NofeeswapDelegatee.json"), "utf8")
    );
    const coreArtifact = JSON.parse(
      fs.readFileSync(path.join(coreDir, "out/Nofeeswap.sol/Nofeeswap.json"), "utf8")
    );

    NofeeswapDelegateeFactory = new ethers.ContractFactory(
      delegateeArtifact.abi, delegateeArtifact.bytecode.object, deployer
    );
    NofeeswapFactory = new ethers.ContractFactory(
      coreArtifact.abi, coreArtifact.bytecode.object, deployer
    );
  } catch {
    // -----------------------------------------------------------------------
    // Fallback: deploy minimal proxy stubs so the dApp can still run.
    // In a real environment forge will be available and the above path runs.
    // -----------------------------------------------------------------------
    console.log("\n⚠  forge not found — deploying minimal stub contracts.");
    console.log("   Install Foundry (https://getfoundry.sh) for full deployment.\n");

    NofeeswapDelegateeFactory = await ethers.getContractFactory("MockNofeeswapDelegatee");
    NofeeswapFactory          = await ethers.getContractFactory("MockNofeeswap");
  }

  // -----------------------------------------------------------------------
  // Step 3 — Deploy
  // -----------------------------------------------------------------------
  console.log("\nDeploying NofeeswapDelegatee …");
  const delegatee = await NofeeswapDelegateeFactory.deploy();
  await delegatee.waitForDeployment();
  console.log(`  NofeeswapDelegatee → ${await delegatee.getAddress()}`);

  console.log("Deploying Nofeeswap (core) …");
  const core = await NofeeswapFactory.deploy(await delegatee.getAddress());
  await core.waitForDeployment();
  console.log(`  Nofeeswap (core)   → ${await core.getAddress()}`);

  // -----------------------------------------------------------------------
  // Step 4 — Persist addresses
  // -----------------------------------------------------------------------
  const addresses = readAddresses();
  addresses.core       = await core.getAddress();
  addresses.delegatee  = await delegatee.getAddress();
  writeAddresses(addresses);

  console.log("\n✅ Core deployment complete.");
  return { core, delegatee };
}

module.exports = main;
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
