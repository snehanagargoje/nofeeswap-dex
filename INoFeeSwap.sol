// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

// ---------------------------------------------------------------------------
// Minimal interface stubs so Hardhat can compile ABIs without the full core.
// These signatures are derived from the NoFeeSwap YellowPaper and the
// INofeeswapDelegatee.sol / IOperator.sol interface files.
// ---------------------------------------------------------------------------

/// @notice Kernel breakpoint: (logPrice, sqrtOffset) pair
/// logPrice  – X59.96 fixed-point log-price (log base √2 of price)
/// sqrtOffset – X96 multiplicative offset applied to the liquidity shape
struct KernelCompact {
    int256 logPrice;     // X59.96
    uint256 sqrtOffset;  // X96
}

/// @notice Minimal interface for the NoFeeSwap core delegatee
interface INofeeswapDelegatee {
    /// @notice Initialize a new liquidity pool
    /// @param poolId     keccak256(abi.encode(token0, token1, poolGrowthPortion, extensions))
    /// @param kernel     Encoded kernel breakpoints (piecewise-linear liquidity shape)
    /// @param curve      Encoded initial price curve sequence
    /// @param sqrtPrice  Initial sqrt(price) in X96 format
    /// @param hookData   Arbitrary data forwarded to hook (empty = no hook)
    function initialize(
        uint256 poolId,
        bytes calldata kernel,
        bytes calldata curve,
        uint256 sqrtPrice,
        bytes calldata hookData
    ) external;

    /// @notice Mint (add) liquidity to an existing pool
    /// @param poolId        Target pool identifier
    /// @param recipient     Address that receives the position NFT / shares
    /// @param logPriceLower Lower bound of position in log-price space (X59.96)
    /// @param logPriceUpper Upper bound of position in log-price space (X59.96)
    /// @param shares        Amount of liquidity shares to mint
    /// @param hookData      Hook calldata
    function mint(
        uint256 poolId,
        address recipient,
        int256 logPriceLower,
        int256 logPriceUpper,
        uint256 shares,
        bytes calldata hookData
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Burn (remove) liquidity from a pool
    /// @param poolId        Target pool identifier
    /// @param logPriceLower Lower bound of position in log-price space
    /// @param logPriceUpper Upper bound of position in log-price space
    /// @param shares        Amount of liquidity shares to burn (0 = full position)
    /// @param hookData      Hook calldata
    function burn(
        uint256 poolId,
        int256 logPriceLower,
        int256 logPriceUpper,
        uint256 shares,
        bytes calldata hookData
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Read the current sqrt price of a pool
    function sqrtPriceX96(uint256 poolId) external view returns (uint256);

    /// @notice Read the current liquidity of a pool
    function liquidity(uint256 poolId) external view returns (uint256);
}

/// @notice Minimal interface for the NoFeeSwap operator (swap router)
interface IOperator {
    struct SwapParams {
        uint256 poolId;
        bool    zeroForOne;      // true = token0 → token1
        int256  amountSpecified; // positive = exact-in, negative = exact-out
        uint256 sqrtPriceLimitX96; // price slippage guard
        bytes   hookData;
    }

    /// @notice Execute a swap through the operator
    function swap(SwapParams calldata params)
        external
        returns (int256 amount0Delta, int256 amount1Delta);

    /// @notice Quote a swap without state changes (view)
    function quoteSwap(SwapParams calldata params)
        external
        view
        returns (int256 amount0Delta, int256 amount1Delta);
}

/// @notice Minimal Nofeeswap core (singleton manager)
interface INofeeswap {
    function delegatee() external view returns (address);

    function dispatch(bytes calldata data) external payable returns (bytes memory);
}
