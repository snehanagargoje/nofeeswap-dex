"use client";
// src/components/PoolStats.tsx

import { ethers } from "ethers";
import type { PoolState, TokenBalances } from "@/hooks/usePool";

interface Props {
  poolState: PoolState | null;
  balances:  TokenBalances | null;
  poolId:    bigint;
  loading:   boolean;
  onRefresh: () => void;
}

export default function PoolStats({ poolState, balances, poolId, loading, onRefresh }: Props) {
  const poolIdHex = "0x" + poolId.toString(16).padStart(64, "0");
  const shortId   = poolIdHex.slice(0, 12) + "…" + poolIdHex.slice(-6);

  return (
    <div className="rounded-2xl border border-border p-5 space-y-4"
         style={{ background: "rgba(26,26,38,0.8)" }}>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg text-text">Pool Status</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg border border-border text-muted hover:text-accent
                     hover:border-accent/30 transition-all disabled:opacity-40"
        >
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={loading ? "animate-spin" : ""}
          >
            <path d="M13 7A6 6 0 0 1 1.5 10.5M1 7A6 6 0 0 1 12.5 3.5"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Pool ID */}
      <div>
        <p className="text-xs text-muted mb-1">Pool ID</p>
        <p className="font-mono text-xs text-accent truncate">{shortId}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-badge">
          <span className="text-xs text-muted">Current Price</span>
          <span className="font-mono text-sm text-text">
            {poolState ? poolState.currentPrice.toFixed(6) : "—"}
          </span>
        </div>
        <div className="stat-badge">
          <span className="text-xs text-muted">√Price (X96)</span>
          <span className="font-mono text-xs text-text truncate">
            {poolState ? poolState.sqrtPriceX96.toString().slice(0, 14) + "…" : "—"}
          </span>
        </div>
        <div className="stat-badge">
          <span className="text-xs text-muted">Liquidity</span>
          <span className="font-mono text-sm text-text">
            {poolState ? ethers.formatEther(poolState.liquidity).slice(0, 10) : "—"}
          </span>
        </div>
        <div className="stat-badge">
          <span className="text-xs text-muted">Growth</span>
          <span className="font-mono text-sm text-success">
            {poolState ? ethers.formatEther(poolState.growth).slice(0, 10) : "—"}
          </span>
        </div>
      </div>

      {/* Wallet balances */}
      {balances && (
        <>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted mb-2 uppercase tracking-wider">Your Balances</p>
            <div className="space-y-2">
              {[
                { sym: balances.token0Symbol, bal: balances.token0, dec: balances.token0Decimals },
                { sym: balances.token1Symbol, bal: balances.token1, dec: balances.token1Decimals },
              ].map(({ sym, bal, dec }) => (
                <div key={sym} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-accent2
                                    flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{sym[0]}</span>
                    </div>
                    <span className="text-sm text-text font-medium">{sym}</span>
                  </div>
                  <span className="font-mono text-sm text-text">
                    {parseFloat(ethers.formatUnits(bal, dec)).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Not connected placeholder */}
      {!poolState && !loading && (
        <div className="text-center py-2">
          <p className="text-xs text-muted">Connect wallet and deploy contracts to see pool data.</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-2">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
