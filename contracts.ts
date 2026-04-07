// src/lib/contracts.ts
// ---------------------------------------------------------------------------
// ABI fragments for interacting with NoFeeSwap core, operator, and tokens.
// Addresses are loaded from addresses.json (populated by deploy scripts).
// ---------------------------------------------------------------------------

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

// NoFeeSwap core — all calls go through the core contract which delegatecalls the delegatee.
// The ABI therefore exposes the delegatee's methods on the core address.
export const CORE_ABI = [
  // Pool initialization
  "function initialize(uint256 poolId, bytes calldata kernel, bytes calldata curve, uint256 sqrtPrice, bytes calldata hookData) external",
  // Liquidity management
  "function mint(uint256 poolId, address recipient, int256 logPriceLower, int256 logPriceUpper, uint256 shares, bytes calldata hookData) external returns (uint256 amount0, uint256 amount1)",
  "function burn(uint256 poolId, int256 logPriceLower, int256 logPriceUpper, uint256 shares, bytes calldata hookData) external returns (uint256 amount0, uint256 amount1)",
  // Views
  "function sqrtPriceX96(uint256 poolId) view returns (uint256)",
  "function liquidity(uint256 poolId) view returns (uint256)",
  "function growth(uint256 poolId) view returns (uint256)",
  // Events
  "event Initialize(uint256 indexed poolId, address token0, address token1, uint256 sqrtPrice)",
  "event Mint(uint256 indexed poolId, address indexed owner, int256 logPriceLower, int256 logPriceUpper, uint256 shares, uint256 amount0, uint256 amount1)",
  "event Burn(uint256 indexed poolId, address indexed owner, int256 logPriceLower, int256 logPriceUpper, uint256 shares, uint256 amount0, uint256 amount1)",
  "event Swap(uint256 indexed poolId, address indexed sender, int256 amount0Delta, int256 amount1Delta, uint256 sqrtPriceX96After)",
];

export const OPERATOR_ABI = [
  "function swap(uint256 poolId, bool zeroForOne, int256 amountSpecified, uint256 sqrtPriceLimitX96, bytes calldata hookData) external returns (int256 amount0Delta, int256 amount1Delta)",
  "function quoteSwap(uint256 poolId, bool zeroForOne, int256 amountSpecified, uint256 sqrtPriceLimitX96) view returns (int256 amount0Delta, int256 amount1Delta)",
];

// ---------------------------------------------------------------------------
// Fixed-point math helpers (mirror of scripts/04_initialize_pool.js)
// ---------------------------------------------------------------------------

const X96  = BigInt("0x1000000000000000000000000"); // 2^96
const X59  = BigInt("0x0800000000000000");           // 2^59

export function encodeSqrtPrice(price: number): bigint {
  return BigInt(Math.floor(Math.sqrt(price) * Number(X96)));
}

export function encodeLogPrice(price: number): bigint {
  const log2 = Math.log2(price);
  const raw   = Math.floor(log2 * Number(X59));
  return BigInt(raw);
}

export function decodeLogPrice(encoded: bigint): number {
  return Number(encoded) / Number(X59);
}

export function decodeSqrtPrice(encoded: bigint): number {
  return (Number(encoded) / Number(X96)) ** 2;
}

export function encodeKernel(breakpoints: { logPrice: bigint; sqrtOffset: bigint }[]): string {
  const chunks: string[] = [];
  for (const bp of breakpoints) {
    const lp  = bp.logPrice >= 0n ? bp.logPrice : (1n << 256n) + bp.logPrice;
    const so  = bp.sqrtOffset;
    chunks.push(lp.toString(16).padStart(64, "0"));
    chunks.push(so.toString(16).padStart(64, "0"));
  }
  return "0x" + chunks.join("");
}

export function encodeCurve(logPrices: bigint[]): string {
  const chunks = logPrices.map((lp) => {
    const v = lp >= 0n ? lp : (1n << 256n) + lp;
    return v.toString(16).padStart(64, "0");
  });
  return "0x" + chunks.join("");
}

export function computePoolId(
  token0: string,
  token1: string,
  poolGrowthPortion: bigint,
  extensions: bigint
): bigint {
  // Matches keccak256(abi.encode(token0, token1, poolGrowthPortion, extensions))
  const { ethers } = require("ethers");
  const hash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "uint256"],
      [token0, token1, poolGrowthPortion, extensions]
    )
  );
  return BigInt(hash);
}

export const Q96 = X96;

// Default pool growth portion: 100% to LPs
export const DEFAULT_POOL_GROWTH_PORTION = BigInt("1000000000000000000"); // 1e18
