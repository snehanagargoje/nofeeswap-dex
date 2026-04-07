"use client";
// src/components/InitializePool.tsx
//
// UI panel for initializing a new NoFeeSwap liquidity pool.
// Encodes kernel + curve + sqrtPrice and calls core.initialize().

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import type { Signer } from "ethers";
import KernelEditor, { KernelBreakpoint, KERNEL_PRESETS } from "./KernelEditor";
import TxToast from "./TxToast";
import type { TxState } from "@/hooks/useWallet";
import {
  encodeKernel, encodeCurve, encodeSqrtPrice, encodeLogPrice,
  computePoolId, DEFAULT_POOL_GROWTH_PORTION, CORE_ABI, ERC20_ABI,
} from "@/lib/contracts";
import addresses from "@/lib/addresses.json";

interface Props {
  signer: Signer | null;
  sendTx: (p: Promise<any>, cb?: (s: TxState) => void) => Promise<any>;
  onSuccess: () => void;
}

export default function InitializePool({ signer, sendTx, onSuccess }: Props) {
  const [token0, setToken0]     = useState(addresses.token0);
  const [token1, setToken1]     = useState(addresses.token1);
  const [priceStr, setPriceStr] = useState("1.0");
  const [growth, setGrowth]     = useState("100"); // percent → scaled to 1e18
  const [breakpoints, setBreakpoints] = useState<KernelBreakpoint[]>(
    KERNEL_PRESETS["Concentrated ±5%"]
  );
  const [tx, setTx]             = useState<TxState>({ status: "idle", hash: null, error: null });
  const [busy, setBusy]         = useState(false);

  const updateTx = useCallback((s: TxState) => setTx(s), []);

  const handleInit = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const price  = parseFloat(priceStr) || 1.0;
      const growthPortion = BigInt(Math.round((parseFloat(growth) / 100) * 1e18));

      // Sort token addresses (protocol requirement)
      const [t0, t1] =
        BigInt(token0) < BigInt(token1) ? [token0, token1] : [token1, token0];

      const poolId = computePoolId(t0, t1, growthPortion, 0n);

      // Encode kernel
      const kernelBytes = encodeKernel(
        breakpoints.map((b) => ({ logPrice: b.logPrice, sqrtOffset: b.sqrtOffset }))
      );

      // Encode curve — symmetric range around initial price
      const logLow  = encodeLogPrice(price / 16);
      const logMid  = encodeLogPrice(price);
      const logHigh = encodeLogPrice(price * 16);
      const curveBytes = encodeCurve([logLow, logMid, logHigh]);

      const sqrtPrice = encodeSqrtPrice(price);

      const core = new ethers.Contract(addresses.core, CORE_ABI, signer);

      await sendTx(
        core.initialize(poolId, kernelBytes, curveBytes, sqrtPrice, "0x"),
        updateTx
      );

      onSuccess();
    } catch (e: any) {
      setTx({ status: "reverted", hash: null, error: e.message ?? "Failed" });
    } finally {
      setBusy(false);
    }
  };

  const price = parseFloat(priceStr) || 1.0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Token Pair */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-muted uppercase tracking-wider">
          Token Pair
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Token 0</label>
            <input
              className="field"
              value={token0}
              onChange={(e) => setToken0(e.target.value)}
              placeholder="0x…"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Token 1</label>
            <input
              className="field"
              value={token1}
              onChange={(e) => setToken1(e.target.value)}
              placeholder="0x…"
            />
          </div>
        </div>
      </div>

      {/* Initial Price */}
      <div>
        <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-2">
          Initial Price (Token1 per Token0)
        </label>
        <div className="relative">
          <input
            type="number"
            className="field pr-20"
            value={priceStr}
            min="0.000001"
            step="0.01"
            onChange={(e) => setPriceStr(e.target.value)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted font-mono">
            T1/T0
          </span>
        </div>
        <p className="text-xs text-muted mt-1.5">
          √Price (X96) = {encodeSqrtPrice(price).toString().slice(0, 18)}…
        </p>
      </div>

      {/* Pool Growth Portion */}
      <div>
        <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-2">
          LP Growth Portion — {growth}%
        </label>
        <input
          type="range"
          min={50}
          max={100}
          value={growth}
          onChange={(e) => setGrowth(e.target.value)}
          style={{ "--val": `${growth}%` } as React.CSSProperties}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>50%</span>
          <span className="text-accent">{growth}% → LPs</span>
          <span>100%</span>
        </div>
        <p className="text-xs text-muted mt-1.5">
          Fraction of swap growth accrued to liquidity providers. Higher = better for LPs.
        </p>
      </div>

      {/* Kernel Editor */}
      <div className="rounded-2xl border border-border p-4" style={{ background: "rgba(10,10,15,0.4)" }}>
        <KernelEditor
          breakpoints={breakpoints}
          onChange={setBreakpoints}
          currentPrice={price}
        />
      </div>

      {/* Pool ID preview */}
      <div className="rounded-xl border border-border px-4 py-3 space-y-1"
           style={{ background: "rgba(124,111,255,0.05)" }}>
        <p className="text-xs text-muted">Computed Pool ID</p>
        <p className="font-mono text-xs text-accent break-all">
          {(() => {
            try {
              const gp = BigInt(Math.round((parseFloat(growth) / 100) * 1e18));
              const [t0, t1] = BigInt(token0) < BigInt(token1)
                ? [token0, token1] : [token1, token0];
              return "0x" + computePoolId(t0, t1, gp, 0n).toString(16).padStart(64, "0");
            } catch { return "Invalid addresses"; }
          })()}
        </p>
      </div>

      <button
        className="btn-primary"
        onClick={handleInit}
        disabled={busy || !signer}
      >
        {busy ? "Initializing Pool…" : "Initialize Pool"}
      </button>

      <TxToast tx={tx} onDismiss={() => setTx({ status: "idle", hash: null, error: null })} />
    </div>
  );
}
