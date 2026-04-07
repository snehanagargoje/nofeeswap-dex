// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ---------------------------------------------------------------------------
// Minimal stub contracts that stand in for the real NoFeeSwap core and
// operator when Foundry (forge) is not available.
//
// These implement the same external interfaces so the dApp can connect and
// the ABI encoding / decoding can be validated end-to-end.
//
// ⚠ NOT for production use — real deployments require the actual NoFeeSwap
//   core and operator contracts from github.com/NoFeeSwap.
// ---------------------------------------------------------------------------

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Stub NoFeeSwap delegatee — stores pool state and emits events.
contract MockNofeeswapDelegatee {
    // PoolId → sqrtPriceX96
    mapping(uint256 => uint256) public sqrtPriceX96;
    // PoolId → liquidity
    mapping(uint256 => uint256) public liquidity;
    // PoolId → growth (increases on each swap)
    mapping(uint256 => uint256) public growth;

    event Initialize(
        uint256 indexed poolId,
        bytes kernel,
        bytes curve,
        uint256 sqrtPrice
    );
    event Mint(
        uint256 indexed poolId,
        address indexed recipient,
        int256 logPriceLower,
        int256 logPriceUpper,
        uint256 shares
    );
    event Burn(
        uint256 indexed poolId,
        address indexed owner,
        int256 logPriceLower,
        int256 logPriceUpper,
        uint256 shares
    );
    event Swap(
        uint256 indexed poolId,
        address indexed sender,
        int256 amount0Delta,
        int256 amount1Delta,
        uint256 sqrtPriceAfter
    );

    function initialize(
        uint256 poolId,
        bytes calldata kernel,
        bytes calldata curve,
        uint256 _sqrtPrice,
        bytes calldata /*hookData*/
    ) external {
        require(sqrtPriceX96[poolId] == 0, "Pool already initialized");
        sqrtPriceX96[poolId] = _sqrtPrice;
        liquidity[poolId]    = 0;
        growth[poolId]       = 1e18; // start at 1.0 growth
        emit Initialize(poolId, kernel, curve, _sqrtPrice);
    }

    function mint(
        uint256 poolId,
        address recipient,
        int256 logPriceLower,
        int256 logPriceUpper,
        uint256 shares,
        bytes calldata /*hookData*/
    ) external returns (uint256 amount0, uint256 amount1) {
        require(sqrtPriceX96[poolId] != 0, "Pool not initialized");
        liquidity[poolId] += shares;
        // Stub: consume equal amounts of both tokens (1:1 simplification)
        amount0 = shares / 2;
        amount1 = shares / 2;
        emit Mint(poolId, recipient, logPriceLower, logPriceUpper, shares);
    }

    function burn(
        uint256 poolId,
        int256 logPriceLower,
        int256 logPriceUpper,
        uint256 shares,
        bytes calldata /*hookData*/
    ) external returns (uint256 amount0, uint256 amount1) {
        require(sqrtPriceX96[poolId] != 0, "Pool not initialized");
        uint256 toBurn = shares == 0 ? liquidity[poolId] : shares;
        liquidity[poolId] = liquidity[poolId] > toBurn ? liquidity[poolId] - toBurn : 0;
        amount0 = toBurn / 2;
        amount1 = toBurn / 2;
        emit Burn(poolId, msg.sender, logPriceLower, logPriceUpper, toBurn);
    }
}

/// @notice Stub NoFeeSwap core — forwards calls to the delegatee via delegatecall.
contract MockNofeeswap {
    address public immutable delegatee;

    constructor(address _delegatee) {
        delegatee = _delegatee;
    }

    fallback() external payable {
        address impl = delegatee;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}

/// @notice Stub operator that wraps the core for swaps.
contract MockOperator {
    address public immutable core;

    constructor(address _core) {
        core = _core;
    }

    event Swap(
        uint256 indexed poolId,
        address indexed sender,
        bool zeroForOne,
        int256 amountSpecified,
        int256 amount0Delta,
        int256 amount1Delta
    );

    function swap(
        uint256 poolId,
        bool zeroForOne,
        int256 amountSpecified,
        uint256 sqrtPriceLimitX96,
        bytes calldata /*hookData*/
    ) external returns (int256 amount0Delta, int256 amount1Delta) {
        // Stub: apply a tiny price impact and emit event
        (amount0Delta, amount1Delta) = _computeSwap(zeroForOne, amountSpecified);
        emit Swap(poolId, msg.sender, zeroForOne, amountSpecified, amount0Delta, amount1Delta);
    }

    function quoteSwap(
        uint256 /*poolId*/,
        bool zeroForOne,
        int256 amountSpecified,
        uint256 /*sqrtPriceLimitX96*/
    ) external pure returns (int256 amount0Delta, int256 amount1Delta) {
        return _computeSwap(zeroForOne, amountSpecified);
    }

    function _computeSwap(bool zeroForOne, int256 amountIn)
        internal pure returns (int256 d0, int256 d1)
    {
        // 0.3% simulated price impact
        int256 out = (amountIn * 997) / 1000;
        if (zeroForOne) {
            d0 = amountIn;   // token0 in (+)
            d1 = -out;       // token1 out (-)
        } else {
            d0 = -out;       // token0 out (-)
            d1 = amountIn;   // token1 in (+)
        }
    }
}
