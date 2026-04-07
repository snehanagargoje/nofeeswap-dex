"use client";
// src/components/ManageLiquidity.tsx
//
// Add (Mint) and Remove (Burn) liquidity for a NoFeeSwap pool.
// Shows current position and allows partial/full withdrawal.

import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import type { Signer } from "ethers";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";
import TxToast from "./TxToast";
import type { TxState } from "@/hooks/useWallet";
import {
  CORE_ABI, ERC20_ABI,
  encodeLogPrice, decodeLogPrice, encodeSqrtPrice,
} from "@/lib/contracts";
import type { PoolState, TokenBalances } from "@/hooks/usePool";
import addresses from "@/lib/addresses.json";

interface Props {
  signer:    Signer | null;
  sendTx:    (p: Promise<any>, cb?: (s: TxState) => void) => Promise<any>;
  poolState: PoolState | null;
  balances:  TokenBalances | null;
  poolId:    bigint;
  onSuccess: () => void;
}

type Mode = "mint" | "burn";

// Build a curve chart showing the liquidity shape
function buildLiquidityChart(currentPrice: number, lower: number, upper: number) {
  const pts = [];
  const PRICES = [0.0625, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
  for (const p of PRICES) {
    const inRange = p >= lower && p <= upper;
    pts.push({ price: p.toFixed(3), liquidity: inRange ? 100 : 15 });
  }
  return pts;
}

export default function ManageLiquidity({
  signer, sendTx, poolState, balances, poolId, onSuccess,
}: Props) {
  const [mode, setMode] = useState<Mode>("mint");

  // Mint state
  const [lowerPrice, setLowerPrice] = useState("0.5");
  const [upperPrice, setUpperPrice] = useState("2.0");
  const [shares, setShares]         = useState("100");
  const [approving, setApproving]   = useState(false);
  const [allowance0, setAllowance0] = useState<bigint>(0n);
  const [allowance1, setAllowance1] = useState<bigint>(0n);

  // Burn state
  const [burnShares, setBurnShares]       = useState("100");
  const [burnPct, setBurnPct]             = useState(100);
  const [burnLower, setBurnLower]         = useState(addresses.logPriceLower);
  const [burnUpper, setBurnUpper]         = useState(addresses.logPriceUpper);
  const [positionShares, setPositionShares] = useState<bigint>(0n);

  const [tx, setTx]   = useState<TxState>({ status: "idle", hash: null, error: null });
  const [busy, setBusy] = useState(false);
  const updateTx = useCallback((s: TxState) => setTx(s), []);

  const currentPrice = poolState?.currentPrice ?? 1.0;
  const lower = parseFloat(lowerPrice) || 0.5;
  const upper = parseFloat(upperPrice) || 2.0;
  const chartData = buildLiquidityChart(currentPrice, lower, upper);

  // Check token allowances
  useEffect(() => {
    if (!signer) return;
    (async () => {
      const addr = await signer.getAddress();
      const t0 = new ethers.Contract(addresses.token0, ERC20_ABI, signer);
      const t1 = new ethers.Contract(addresses.token1, ERC20_ABI, signer);
      const [a0, a1] = await Promise.all([
        t0.allowance(addr, addresses.core),
        t1.allowance(addr, addresses.core),
      ]);
      setAllowance0(BigInt(a0));
      setAllowance1(BigInt(a1));
    })();
  }, [signer, busy]);

  const handleApprove = async () => {
    if (!signer) return;
    setApproving(true);
    try {
      const t0 = new ethers.Contract(addresses.token0, ERC20_ABI, signer);
      const t1 = new ethers.Contract(addresses.token1, ERC20_ABI, signer);
      await sendTx(t0.approve(addresses.core, ethers.MaxUint256), updateTx);
      await sendTx(t1.approve(addresses.core, ethers.MaxUint256), updateTx);
    } finally {
      setApproving(false);
    }
  };

  const handleMint = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const core       = new ethers.Contract(addresses.core, CORE_ABI, signer);
      const logLower   = encodeLogPrice(lower);
      const logUpper   = encodeLogPrice(upper);
      const shareBN    = ethers.parseEther(shares || "0");
      const addr       = await signer.getAddress();
      await sendTx(
        core.mint(poolId, addr, logLower, logUpper, shareBN, "0x"),
        updateTx
      );
      onSuccess();
    } catch (e: any) {
      setTx({ status: "reverted", hash: null, error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleBurn = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const core      = new ethers.Contract(addresses.core, CORE_ABI, signer);
      const logLower  = BigInt(burnLower);
      const logUpper  = BigInt(burnUpper);
      // 0 shares = burn full position
      const shareBN   = burnPct === 100 ? 0n : ethers.parseEther(burnShares || "0");
      await sendTx(
        core.burn(poolId, logLower, logUpper, shareBN, "0x"),
        updateTx
      );
      onSuccess();
    } catch (e: any) {
      setTx({ status: "reverted", hash: null, error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const needsApproval = allowance0 === 0n || allowance1 === 0n;
  const sym0 = balances?.token0Symbol ?? "TK0";
  const sym1 = balances?.token1Symbol ?? "TK1";
  const bal0 = balances ? ethers.formatEther(balances.token0).slice(0, 10) : "—";
  const bal1 = balances ? ethers.formatEther(balances.token1).slice(0, 10) : "—";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Mode tabs */}
      <div className="flex gap-2 p-1 rounded-xl border border-border bg-surface/50">
        {(["mint", "burn"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold font-display transition-all ${
              mode === m
                ? m === "mint"
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-danger/15 text-danger border border-danger/30"
                : "text-muted hover:text-text"
            }`}
          >
            {m === "mint" ? "＋ Add Liquidity" : "－ Remove Liquidity"}
          </button>
        ))}
      </div>

      {/* Balances row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-badge">
          <span className="text-xs text-muted">{sym0} Balance</span>
          <span className="font-mono text-sm text-text">{bal0}</span>
        </div>
        <div className="stat-badge">
          <span className="text-xs text-muted">{sym1} Balance</span>
          <span className="font-mono text-sm text-text">{bal1}</span>
        </div>
      </div>

      {/* ====== MINT MODE ====== */}
      {mode === "mint" && (
        <div className="space-y-4">
          {/* Price Range — interactive chart */}
          <div>
            <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-2">
              Price Range (Token1/Token0)
            </label>
            <div className="rounded-xl overflow-hidden border border-border mb-3"
                 style={{ background: "rgba(10,10,15,0.6)" }}>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="liqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="price"
                    tick={{ fill: "#7070a0", fontSize: 10, fontFamily: "DM Mono" }}
                    axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 120]} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a26", border: "1px solid #2a2a3d",
                      borderRadius: 10, fontFamily: "DM Mono", fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, "Relative Liquidity"]}
                  />
                  {/* Shade selected range */}
                  <ReferenceArea
                    x1={lower.toFixed(3)} x2={upper.toFixed(3)}
                    fill="rgba(124,111,255,0.08)" stroke="rgba(124,111,255,0.3)"
                  />
                  <ReferenceLine
                    x={currentPrice.toFixed(3)} stroke="#ff6f91"
                    strokeDasharray="4 4"
                    label={{ value: "now", fill: "#ff6f91", fontSize: 9 }}
                  />
                  <Area type="monotone" dataKey="liquidity"
                    stroke="#4ade80" strokeWidth={2}
                    fill="url(#liqGrad)"
                    dot={{ fill: "#4ade80", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Min Price</label>
                <input type="number" className="field" value={lowerPrice}
                  onChange={(e) => setLowerPrice(e.target.value)} min="0.001" step="0.01" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Max Price</label>
                <input type="number" className="field" value={upperPrice}
                  onChange={(e) => setUpperPrice(e.target.value)} min="0.001" step="0.01" />
              </div>
            </div>
          </div>

          {/* Shares amount */}
          <div>
            <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-2">
              Liquidity Shares to Mint
            </label>
            <input type="number" className="field" value={shares}
              onChange={(e) => setShares(e.target.value)} min="0.001" />
            <p className="text-xs text-muted mt-1.5">
              Log-price lower: {encodeLogPrice(lower).toString()}&nbsp;&nbsp;
              Log-price upper: {encodeLogPrice(upper).toString()}
            </p>
          </div>

          {/* Approve then Mint */}
          {needsApproval ? (
            <button className="btn-primary" onClick={handleApprove} disabled={approving || !signer}>
              {approving ? "Approving tokens…" : "Approve Tokens"}
            </button>
          ) : (
            <button className="btn-primary" onClick={handleMint} disabled={busy || !signer}>
              {busy ? "Adding Liquidity…" : "Add Liquidity"}
            </button>
          )}
        </div>
      )}

      {/* ====== BURN MODE ====== */}
      {mode === "burn" && (
        <div className="space-y-4">
          {/* Current position info */}
          <div className="rounded-xl border border-border px-4 py-3 space-y-2"
               style={{ background: "rgba(248,113,113,0.05)" }}>
            <p className="text-xs text-muted uppercase tracking-wider">Active Position</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted">Log-Price Lower</p>
                <p className="font-mono text-xs text-text truncate">{burnLower}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Log-Price Upper</p>
                <p className="font-mono text-xs text-text truncate">{burnUpper}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <p className="text-xs text-muted">Price Lower (approx)</p>
                <p className="font-mono text-xs text-accent">
                  ~{Math.pow(2, Number(BigInt(burnLower)) / 2**59).toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Price Upper (approx)</p>
                <p className="font-mono text-xs text-accent">
                  ~{Math.pow(2, Number(BigInt(burnUpper)) / 2**59).toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {/* Burn percentage */}
          <div>
            <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-2">
              Remove — {burnPct}%
            </label>
            <div className="flex gap-2 mb-3">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setBurnPct(pct)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                    burnPct === pct
                      ? "bg-danger/15 text-danger border-danger/30"
                      : "border-border text-muted hover:text-text hover:border-border/80"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <input
              type="range" min={1} max={100} value={burnPct}
              onChange={(e) => setBurnPct(Number(e.target.value))}
              style={{ "--val": `${burnPct}%` } as React.CSSProperties}
              className="w-full"
            />
          </div>

          {burnPct < 100 && (
            <div>
              <label className="text-xs text-muted mb-1 block">Custom Shares to Burn</label>
              <input type="number" className="field" value={burnShares}
                onChange={(e) => setBurnShares(e.target.value)} />
              <p className="text-xs text-muted mt-1">Pass 0 to burn entire position.</p>
            </div>
          )}

          <div className="rounded-xl border border-danger/20 px-4 py-3 bg-danger/5">
            <p className="text-xs text-danger">
              {burnPct === 100
                ? "⚠ This will burn your full position and return all tokens."
                : `⚠ This will burn ~${burnPct}% of your position.`}
            </p>
          </div>

          <button
            className="w-full py-3.5 rounded-xl font-display font-semibold text-white text-sm
                       tracking-wide transition-all duration-200 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #ef4444, #f87171)" }}
            onClick={handleBurn}
            disabled={busy || !signer}
          >
            {busy ? "Removing Liquidity…" : "Remove Liquidity"}
          </button>
        </div>
      )}

      <TxToast tx={tx} onDismiss={() => setTx({ status: "idle", hash: null, error: null })} />
    </div>
  );
}
