# NoFeeSwap Local Dev Environment + dApp

A complete local development environment and Web3 front-end for the NoFeeSwap AMM protocol.

---

## Architecture Overview

```
nofeeswap-dapp/
├── contracts/           # Solidity contracts (mock tokens, interfaces)
├── scripts/             # Hardhat deploy scripts
├── hardhat.config.js    # Hardhat configuration (Anvil-compatible)
├── dapp/                # Next.js front-end
│   └── src/
│       ├── components/  # React components (Pool, Swap, Liquidity, Kernel)
│       ├── hooks/       # Web3 hooks (useWallet, usePool, useSwap)
│       └── lib/         # ABI definitions, contract addresses
└── README.md
```

---

## Task 1: Protocol Deployment (Local Environment)

### Prerequisites

```bash
# Install Foundry (includes Anvil)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# OR use Hardhat node (included in this repo)
npm install
```

### Step 1: Clone NoFeeSwap Core

```bash
git clone https://github.com/NoFeeSwap/core.git nofeeswap-core
cd nofeeswap-core
git submodule update --init --depth 1

# Install Python env (core uses Brownie tests)
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

### Step 2: Clone NoFeeSwap Operator

```bash
git clone https://github.com/NoFeeSwap/operator.git nofeeswap-operator
cd nofeeswap-operator
git submodule update --init --depth 1
pip install -r requirements.txt
```

### Step 3: Launch Local Blockchain

**Option A — Anvil (preferred):**
```bash
# In a dedicated terminal:
anvil --chain-id 31337 --port 8545 --accounts 10 --balance 10000
```

**Option B — Hardhat node:**
```bash
# From this repo root:
npx hardhat node --port 8545
```

### Step 4: Deploy NoFeeSwap Core

The core repo uses Brownie + Hardhat. From `nofeeswap-core/`:

```bash
source venv/bin/activate
brownie test ./tests/Initialize_test.py --network hardhat --interactive
```

Or use the provided Hardhat deploy script:

```bash
# From this repo root (nofeeswap-dapp/):
npx hardhat run scripts/01_deploy_core.js --network localhost
```

This deploys:
- `Nofeeswap.sol` — the core singleton pool manager
- `NofeeswapDelegatee.sol` — delegatee for pool logic

### Step 5: Deploy NoFeeSwap Operator

```bash
npx hardhat run scripts/02_deploy_operator.js --network localhost
```

### Step 6: Deploy Mock Tokens & Mint

```bash
npx hardhat run scripts/03_deploy_tokens.js --network localhost
```

This mints **10,000 TOKEN_A** and **10,000 TOKEN_B** to account[0] (your test wallet).

### Step 7: Initialize a Pool

```bash
npx hardhat run scripts/04_initialize_pool.js --network localhost
```

This initializes a TOKEN_A/TOKEN_B pool with a mock kernel (uniform liquidity distribution).

### Deployed Addresses

After running all scripts, addresses are saved to `dapp/src/lib/addresses.json`.

---

## Task 2: dApp Front-End

### Prerequisites

```bash
cd dapp
npm install
npm run dev
# Open http://localhost:3000
```

### MetaMask Setup

1. Open MetaMask → Add Network manually:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

2. Import test wallet private key (Anvil/Hardhat account[0]):
   ```
   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```

### Features

| Tab | Description |
|-----|-------------|
| **Initialize Pool** | Deploy a new TOKEN_A/TOKEN_B pool with graphical kernel editor |
| **Add Liquidity** | Mint liquidity positions with price range selection |
| **Remove Liquidity** | Burn positions (partial or full) |
| **Swap** | Trade TOKEN_A ↔ TOKEN_B with slippage control |

---

## NoFeeSwap Protocol Notes

NoFeeSwap differs from Uniswap in key ways:

1. **Kernel**: Instead of tick-based concentrated liquidity, NoFeeSwap uses a *kernel* — a piecewise-linear function defining the liquidity distribution shape over log-price space. Each segment is defined by `(logPrice, sqrtOffset)` pairs.

2. **Zero Spread**: Buy and sell marginal prices are identical — no fee extracted from trades; instead liquidity grows after every swap.

3. **PoolId**: `keccak256(token0, token1, poolGrowthPortion, extensions)` — no tick spacing, no fee tier per se.

4. **Initialize Parameters** (per `INofeeswapDelegatee.sol#L11`):
   - `poolId` — derived from token pair + growth portion
   - `kernel` — encoded liquidity shape (array of `(logPrice, sqrtOffset)`)
   - `curve` — encoded price curve sequence
   - `sqrtPrice` — initial sqrt price (X96 format)
   - `hookData` — optional hook calldata

---

## References

- [NoFeeSwap Core](https://github.com/NoFeeSwap/core)
- [NoFeeSwap Operator](https://github.com/NoFeeSwap/operator)
- [NoFeeSwap YellowPaper](https://github.com/NoFeeSwap/docs)
- [NoFeeSwap Website](https://www.nofeeswap.org)
