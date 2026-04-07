/**
 * scripts/04_initialize_pool.js
 *
 * Initializes a NoFeeSwap TOKEN_A/TOKEN_B pool.
 *
 * Pool initialization per INofeeswapDelegatee.sol#L11:
 *   initialize(poolId, kernel, curve, sqrtPrice, hookData)
 *
 * Kernel encoding reference: SwapData_test.py#L841-L846
 * Uses a simple "mock" kernel representing uniform concentrated liquidity.
 *
 * Also adds initial liquidity via mint() so the pool is ready for swaps.
 *
 * Usage:
 *   npx hardhat run scripts/04_initialize_pool.js --network localhost
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

// ---------------------------------------------------------------------------
// NoFeeSwap fixed-point helpers
// ---------------------------------------------------------------------------

const X96  = 2n ** 96n;
const X59  = 2n ** 59n;

/**
 * Encode a sqrt price for NoFeeSwap's X96 format.
 * sqrtPrice = sqrt(price) * 2^96
 * For price = 1.0 (TOKEN_A:TOKEN_B = 1:1): sqrtPrice = 2^96
 */
function encodeSqrtPrice(price = 1.0) {
  const sqrtPrice = Math.sqrt(price);
  return BigInt(Math.floor(sqrtPrice * Number(X96)));
}

/**
 * Encode a log-price in X59.96 format.
 * NoFeeSwap uses log base √2 of the price ratio.
 * logPrice = log(price) / log(√2) * 2^59
 */
function encodeLogPrice(price = 1.0) {
  // log base √2 = log2(price)
  const log2Price = Math.log2(price);
  return BigInt(Math.floor(log2Price * Number(X59)));
}

/**
 * Encode kernel breakpoints as bytes.
 *
 * From SwapData_test.py#L841-L846, the mock kernel uses a simple
 * two-breakpoint uniform shape:
 *   [(logPriceLow, sqrtOffset=1), (logPriceHigh, sqrtOffset=1)]
 *
 * Each breakpoint is packed as: int256(logPrice) ++ uint256(sqrtOffset)
 * = 64 bytes per breakpoint.
 *
 * The kernel array is ABI-encoded as a dynamic bytes sequence.
 */
function encodeKernel(breakpoints) {
  // Each breakpoint: 32 bytes logPrice (int256) + 32 bytes sqrtOffset (uint256)
  const buf = Buffer.alloc(breakpoints.length * 64);
  for (let i = 0; i < breakpoints.length; i++) {
    const { logPrice, sqrtOffset } = breakpoints[i];
    // Write logPrice as 32-byte big-endian two's-complement
    const lp = logPrice >= 0n ? logPrice : (1n << 256n) + logPrice;
    const lpHex = lp.toString(16).padStart(64, "0");
    Buffer.from(lpHex, "hex").copy(buf, i * 64);
    // Write sqrtOffset as 32-byte big-endian unsigned
    const soHex = sqrtOffset.toString(16).padStart(64, "0");
    Buffer.from(soHex, "hex").copy(buf, i * 64 + 32);
  }
  return "0x" + buf.toString("hex");
}

/**
 * Encode the curve sequence.
 *
 * From SwapData_test.py, the curve is a sequence of log-price anchors
 * that define the initial price path. For a simple pool we use a single
 * segment centred at the initial price.
 *
 * Format: array of int256 (X59.96 log-prices), ABI-encoded.
 */
function encodeCurve(logPrices) {
  const buf = Buffer.alloc(logPrices.length * 32);
  for (let i = 0; i < logPrices.length; i++) {
    const lp = logPrices[i] >= 0n ? logPrices[i] : (1n << 256n) + logPrices[i];
    const hex = lp.toString(16).padStart(64, "0");
    Buffer.from(hex, "hex").copy(buf, i * 32);
  }
  return "0x" + buf.toString("hex");
}

/**
 * Compute the NoFeeSwap poolId.
 * poolId = keccak256(abi.encode(token0, token1, poolGrowthPortion, extensions))
 *
 * poolGrowthPortion — fraction of growth that goes to LPs (e.g. 1e18 = 100%)
 * extensions        — hook contract address (address(0) = no hook)
 */
function computePoolId(token0, token1, poolGrowthPortion, extensions) {
  return BigInt(
    ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256"],
        [token0, token1, poolGrowthPortion, extensions]
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses  = readAddresses();

  if (!addresses.core || !addresses.token0 || !addresses.token1) {
    throw new Error("Core and token deployments must complete first.");
  }

  // -----------------------------------------------------------------------
  // Attach to core delegatee
  // -----------------------------------------------------------------------
  const DELEGATEE_ABI = [
    "function initialize(uint256 poolId, bytes calldata kernel, bytes calldata curve, uint256 sqrtPrice, bytes calldata hookData) external",
    "function mint(uint256 poolId, address recipient, int256 logPriceLower, int256 logPriceUpper, uint256 shares, bytes calldata hookData) external returns (uint256, uint256)",
    "function sqrtPriceX96(uint256 poolId) external view returns (uint256)",
    "function liquidity(uint256 poolId) external view returns (uint256)",
  ];

  // NoFeeSwap uses a dispatch pattern: calls go to the core contract which
  // delegatecalls the delegatee.  We send transactions to `core`.
  const core = new ethers.Contract(addresses.core, DELEGATEE_ABI, deployer);

  // -----------------------------------------------------------------------
  // Pool parameters
  // -----------------------------------------------------------------------
  const POOL_GROWTH_PORTION = ethers.parseEther("1"); // 100% growth to LPs
  const EXTENSIONS          = 0n;                      // no hook

  const poolId = computePoolId(
    addresses.token0,
    addresses.token1,
    POOL_GROWTH_PORTION,
    EXTENSIONS
  );
  console.log(`\nPool ID: ${poolId.toString(16)} (hex)`);

  // -----------------------------------------------------------------------
  // Build kernel — mock uniform liquidity over ±4 price doublings
  // (SwapData_test.py#L841-L846 pattern)
  //
  // Breakpoints at log-prices corresponding to price 0.0625 (2^-4) and
  // price 16 (2^4), sqrtOffset = 2^96 (unit, i.e. no scaling).
  // -----------------------------------------------------------------------
  const sqrtOffsetUnit = X96;   // 1.0 in X96 = no multiplicative offset
  const logPriceLow    = encodeLogPrice(1 / 16); // price = 0.0625
  const logPriceHigh   = encodeLogPrice(16.0);   // price = 16

  const kernel = encodeKernel([
    { logPrice: logPriceLow,  sqrtOffset: sqrtOffsetUnit },
    { logPrice: logPriceHigh, sqrtOffset: sqrtOffsetUnit },
  ]);

  // -----------------------------------------------------------------------
  // Build curve sequence — a simple two-point sequence anchored at price=1
  // -----------------------------------------------------------------------
  const curve = encodeCurve([
    encodeLogPrice(1 / 16),
    encodeLogPrice(1.0),
    encodeLogPrice(16.0),
  ]);

  // -----------------------------------------------------------------------
  // Initial sqrt price = 1:1
  // -----------------------------------------------------------------------
  const sqrtPrice = encodeSqrtPrice(1.0);

  // -----------------------------------------------------------------------
  // Send initialize transaction
  // -----------------------------------------------------------------------
  console.log("Initializing pool …");
  const tx = await core.initialize(poolId, kernel, curve, sqrtPrice, "0x");
  const receipt = await tx.wait();
  console.log(`  Pool initialized — tx: ${receipt.hash}`);

  // -----------------------------------------------------------------------
  // Add initial seed liquidity via mint()
  // -----------------------------------------------------------------------
  const SEED_SHARES  = ethers.parseEther("1000");
  const logLower     = encodeLogPrice(1 / 4);  // price range 0.25 → 4
  const logUpper     = encodeLogPrice(4.0);

  console.log("Adding seed liquidity (mint) …");
  const mintTx = await core.mint(
    poolId,
    deployer.address,
    logLower,
    logUpper,
    SEED_SHARES,
    "0x"
  );
  const mintReceipt = await mintTx.wait();
  console.log(`  Mint tx: ${mintReceipt.hash}`);

  // -----------------------------------------------------------------------
  // Persist pool info
  // -----------------------------------------------------------------------
  addresses.poolId           = "0x" + poolId.toString(16).padStart(64, "0");
  addresses.poolGrowthPortion = POOL_GROWTH_PORTION.toString();
  addresses.extensions        = EXTENSIONS.toString();
  addresses.initialSqrtPrice  = sqrtPrice.toString();
  addresses.logPriceLower     = logLower.toString();
  addresses.logPriceUpper     = logUpper.toString();
  writeAddresses(addresses);

  console.log("\n✅ Pool initialized and seeded with liquidity.");
  console.log("   Pool ID:", addresses.poolId);

  return { poolId };
}

module.exports = main;
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
