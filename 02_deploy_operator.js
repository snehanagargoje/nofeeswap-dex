/**
 * scripts/02_deploy_operator.js
 *
 * Clones (if needed) and deploys the NoFeeSwap operator contract.
 *
 * The operator wraps the core and exposes a convenient swap/mint/burn
 * interface as documented in SwapData_test.py.
 *
 * Usage:
 *   npx hardhat run scripts/02_deploy_operator.js --network localhost
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
  const addresses  = readAddresses();

  if (!addresses.core) {
    throw new Error("Core contracts not deployed yet. Run 01_deploy_core.js first.");
  }

  // -----------------------------------------------------------------------
  // Clone the operator repo if not present
  // -----------------------------------------------------------------------
  const operatorDir = path.join(__dirname, "../../nofeeswap-operator");
  if (!fs.existsSync(operatorDir)) {
    console.log("\nCloning NoFeeSwap/operator …");
    execSync(
      `git clone https://github.com/NoFeeSwap/operator.git ${operatorDir} && ` +
      `cd ${operatorDir} && git submodule update --init --depth 1`,
      { stdio: "inherit" }
    );
  } else {
    console.log(`Operator repo already present at ${operatorDir}`);
  }

  // -----------------------------------------------------------------------
  // Compile & deploy
  // -----------------------------------------------------------------------
  let OperatorFactory;

  try {
    execSync("forge --version", { stdio: "pipe" });
    console.log("\nCompiling operator with forge …");
    execSync(`cd ${operatorDir} && forge build --out out --lib-paths lib`, { stdio: "inherit" });

    const artifact = JSON.parse(
      fs.readFileSync(path.join(operatorDir, "out/Operator.sol/Operator.json"), "utf8")
    );
    OperatorFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, deployer);
  } catch {
    console.log("⚠  forge not found — deploying stub Operator contract.\n");
    OperatorFactory = await ethers.getContractFactory("MockOperator");
  }

  console.log("Deploying Operator …");
  const operator = await OperatorFactory.deploy(addresses.core);
  await operator.waitForDeployment();
  console.log(`  Operator → ${await operator.getAddress()}`);

  addresses.operator = await operator.getAddress();
  writeAddresses(addresses);

  console.log("\n✅ Operator deployment complete.");
  return { operator };
}

module.exports = main;
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
