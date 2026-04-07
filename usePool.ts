"use client";
// src/hooks/usePool.ts

import { useState, useEffect, useCallback } from "react";
import { ethers, Contract, Signer } from "ethers";
import { CORE_ABI, OPERATOR_ABI, ERC20_ABI, decodeSqrtPrice } from "@/lib/contracts";
import addresses from "@/lib/addresses.json";

export interface PoolState {
  sqrtPriceX96: bigint;
  currentPrice: number;
  liquidity:    bigint;
  growth:       bigint;
}

export interface TokenBalances {
  token0: bigint;
  token1: bigint;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
}

export function usePool(signer: Signer | null) {
  const [poolState, setPoolState]   = useState<PoolState | null>(null);
  const [balances, setBalances]     = useState<TokenBalances | null>(null);
  const [loading, setLoading]       = useState(false);

  const coreAddr     = addresses.core;
  const token0Addr   = addresses.token0;
  const token1Addr   = addresses.token1;
  const poolId       = BigInt(addresses.poolId);

  const refresh = useCallback(async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const provider = signer.provider!;
      const core   = new Contract(coreAddr, CORE_ABI, provider);
      const t0     = new Contract(token0Addr, ERC20_ABI, provider);
      const t1     = new Contract(token1Addr, ERC20_ABI, provider);
      const owner  = await signer.getAddress();

      const [sqrtP, liq, growth, bal0, bal1, sym0, sym1, dec0, dec1] = await Promise.all([
        core.sqrtPriceX96(poolId).catch(() => 0n),
        core.liquidity(poolId).catch(() => 0n),
        core.growth(poolId).catch(() => 0n),
        t0.balanceOf(owner),
        t1.balanceOf(owner),
        t0.symbol(),
        t1.symbol(),
        t0.decimals(),
        t1.decimals(),
      ]);

      setPoolState({
        sqrtPriceX96: BigInt(sqrtP),
        currentPrice: decodeSqrtPrice(BigInt(sqrtP)),
        liquidity:    BigInt(liq),
        growth:       BigInt(growth),
      });

      setBalances({
        token0: BigInt(bal0),
        token1: BigInt(bal1),
        token0Symbol: sym0,
        token1Symbol: sym1,
        token0Decimals: Number(dec0),
        token1Decimals: Number(dec1),
      });
    } catch (e) {
      console.error("usePool refresh error:", e);
    } finally {
      setLoading(false);
    }
  }, [signer, coreAddr, token0Addr, token1Addr, poolId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Contracts bound to signer for writes
  const getContracts = useCallback(() => {
    if (!signer) return null;
    return {
      core:     new Contract(coreAddr,             CORE_ABI,     signer),
      operator: new Contract(addresses.operator,   OPERATOR_ABI, signer),
      token0:   new Contract(token0Addr,           ERC20_ABI,    signer),
      token1:   new Contract(token1Addr,           ERC20_ABI,    signer),
    };
  }, [signer, coreAddr, token0Addr, token1Addr]);

  return { poolState, balances, loading, refresh, getContracts, poolId };
}
