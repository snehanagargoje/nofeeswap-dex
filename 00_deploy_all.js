/**
 * scripts/00_deploy_all.js
 *
 * Master deployment script — runs all steps in sequence and writes
 * a unified addresses.json consumed by the dApp.
 *
 * Usage:
 *   npx hardhat run scripts/00_deploy_all.js --network localhost
 */

const { execSync } = require("child_process");
const path = require("path");

const SCRIPTS = [
  "01_deploy_core.js",
  "02_deploy_operator.js",
  "03_deploy_tokens.js",
  "04_initialize_pool.js",
];

async function main() {
  console.log("=".repeat(60));
  console.log("  NoFeeSwap — Full Local Deployment");
  console.log("=".repeat(60));

  for (const script of SCRIPTS) {
    const scriptPath = path.join(__dirname, script);
    console.log(`\n▶  Running ${script} …`);
    // Each sub-script is also self-contained; we just require() it here.
    // Because Hardhat re-uses the same hre across requires in the same
    // process we call them directly.
    await require(scriptPath)();
    console.log(`✅  ${script} complete`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("  All deployments complete!");
  console.log("  Addresses written to: dapp/src/lib/addresses.json");
  console.log("=".repeat(60));
}

main().catch((e) => { console.error(e); process.exit(1); });
