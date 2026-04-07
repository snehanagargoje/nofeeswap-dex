"use client";
// src/components/SwapPanel.tsx
//
// Token swap UI for NoFeeSwap.
// Features:
//  - Token direction toggle (Token0 → Token1 or reverse)
//  - Real-time output quote via operator.quoteSwap()
//  - Slippage tolerance slider
//  - Price impact display
//  - Pending / Confirmed / Reverted feedback

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import type { Signer } from "ethers";
import TxToast from "./TxToast";
import type { TxState } from "@/hooks/useWallet";
import { OPERATOR_ABI, ERC20_ABI, encodeSqrtPrice } from "@/lib/contracts";
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

const MAX_SLIPPAGE = 50; // 50%

export default function SwapPanel({
  signer, sendTx, poolState, balances, poolId, onSuccess,
}: Props) {
  const [zeroForOne, setZeroForOne] = useState(true);        // direction
  const [amountIn, setAmountIn]     = useState("");           // input amount string
  const [slippage, setSlippage]     = useState(0.5);          // %
  const [quote, setQuote]           = useState<{
    amountOut: bigint;
    priceImpact: number;
    limitPrice: bigint;
  } | null>(null);
  const [quoting, setQuoting]       = useState(false);
  const [tx, setTx]                 = useState<TxState>({ status: "idle", hash: null, error: null });
  const [busy, setBusy]             = useState(false);
  const [allowance, setAllowance]   = useState<bigint>(0n);
  const [approving, setApproving]   = useState(false);

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateTx = useCallback((s: TxState) => setTx(s), []);

  const sym0 = balances?.token0Symbol ?? "TOKEN0";
  const sym1 = balances?.token1Symbol ?? "TOKEN1";
  const inSym  = zeroForOne ? sym0 : sym1;
  const outSym = zeroForOne ? sym1 : sym0;
  const inBal  = balances
    ? ethers.formatEther(zeroForOne ? balances.token0 : balances.token1).slice(0, 12)
    : "—";

  const currentPrice = poolState?.currentPrice ?? 1;

  // Check allowance for input token
  useEffect(() => {
    if (!signer) return;
    (async () => {
      const tokenAddr = zeroForOne ? addresses.token0 : addresses.token1;
      const t = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      const addr = await signer.getAddress();
      const a = await t.allowance(addr, addresses.operator);
      setAllowance(BigInt(a));
    })();
  }, [signer, zeroForOne, busy]);

  // Debounced quote
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !signer) {
      setQuote(null);
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => fetchQuote(), 500);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
  }, [amountIn, zeroForOne, slippage, signer]);

  const fetchQuote = async () => {
    if (!signer || !amountIn) return;
    setQuoting(true);
    try {
      const operator = new ethers.Contract(addresses.operator, OPERATOR_ABI, signer);
      const amtBN    = ethers.parseEther(amountIn);

      // Slippage-adjusted price limit
      const priceAfterSlip = zeroForOne
        ? currentPrice * (1 - slippage / 100)
        : currentPrice * (1 + slippage / 100);
      const limitPrice = encodeSqrtPrice(Math.max(priceAfterSlip, 1e-12));

      const [d0, d1] = await operator.quoteSwap(
        poolId,
        zeroForOne,
        amtBN,          // exact-in: positive
        limitPrice
      );

      const amtOut = zeroForOne ? BigInt(d1) * -1n : BigInt(d0) * -1n;
      const amtOutF = parseFloat(ethers.formatEther(amtOut < 0n ? 0n : amtOut));
      const amtInF  = parseFloat(amountIn);
      const execPrice = zeroForOne ? amtInF / amtOutF : amtOutF / amtInF;
      const impact    = Math.abs((execPrice - currentPrice) / currentPrice) * 100;

      setQuote({ amountOut: amtOut < 0n ? 0n : amtOut, priceImpact: impact, limitPrice });
    } catch {
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  };

  const handleApprove = async () => {
    if (!signer) return;
    setApproving(true);
    try {
      const tokenAddr = zeroForOne ? addresses.token0 : addresses.token1;
      const t = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      await sendTx(t.approve(addresses.operator, ethers.MaxUint256), updateTx);
    } finally {
      setApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!signer || !amountIn || !quote) return;
    setBusy(true);
    try {
      const operator = new ethers.Contract(addresses.operator, OPERATOR_ABI, signer);
      const amtBN    = ethers.parseEther(amountIn);
      await sendTx(
        operator.swap(poolId, zeroForOne, amtBN, quote.limitPrice, "0x"),
        updateTx
      );
      setAmountIn("");
      setQuote(null);
      onSuccess();
    } catch (e: any) {
      setTx({ status: "reverted", hash: null, error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const flip = () => {
    setZeroForOne((z) => !z);
    setAmountIn("");
    setQuote(null);
  };

  const needsApproval = allowance === 0n && !!amountIn && parseFloat(amountIn) > 0;

  const impactColor =
    !quote              ? "text-muted"
    : quote.priceImpact < 0.5 ? "text-success"
    : quote.priceImpact < 2   ? "text-warn"
    : "text-danger";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Current price info */}
      {poolState && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-surface/40">
          <span className="text-xs text-muted">Current Price</span>
          <span className="font-mono text-sm text-text">
            1 {sym0} = {currentPrice.toFixed(6)} {sym1}
          </span>
        </div>
      )}

      {/* Input token */}
      <div className="rounded-2xl border border-border p-4 space-y-2 bg-surface/60">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>You Pay</span>
          <button
            className="hover:text-accent transition-colors"
            onClick={() => setAmountIn(inBal.replace(",", ""))}
          >
            Balance: {inBal}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border shrink-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{inSym[0]}</span>
            </div>
            <span className="font-display font-semibold text-sm text-text">{inSym}</span>
          </div>
          <input
            type="number"
            className="flex-1 bg-transparent text-right text-2xl font-mono font-light text-text
                       focus:outline-none placeholder:text-muted/40"
            placeholder="0.0"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            min="0"
          />
        </div>
      </div>

      {/* Flip button */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={flip}
          className="w-10 h-10 rounded-xl border border-border bg-card
                     flex items-center justify-center text-muted
                     hover:text-accent hover:border-accent/40 hover:bg-accent/5
                     transition-all active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M4 10l4 4 4-4M4 6l4-4 4 4" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Output token */}
      <div className="rounded-2xl border border-border p-4 space-y-2 bg-surface/60">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>You Receive (estimated)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border shrink-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent2 to-accent flex items-center justify-center">
              <span className="text-white text-xs font-bold">{outSym[0]}</span>
            </div>
            <span className="font-display font-semibold text-sm text-text">{outSym}</span>
          </div>
          <div className="flex-1 text-right">
            {quoting ? (
              <div className="flex justify-end">
                <div className="h-7 w-24 rounded-lg bg-border/40 animate-pulse" />
              </div>
            ) : (
              <span className="text-2xl font-mono font-light text-text">
                {quote ? ethers.formatEther(quote.amountOut).slice(0, 10) : "—"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Slippage control */}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-muted">Slippage Tolerance</span>
          <span className="font-mono text-xs text-accent font-medium">{slippage.toFixed(1)}%</span>
        </div>
        <div className="flex gap-2 items-center">
          {[0.1, 0.5, 1.0, 3.0].map((v) => (
            <button
              key={v}
              onClick={() => setSlippage(v)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all border ${
                slippage === v
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              {v}%
            </button>
          ))}
          <input
            type="range" min={0.1} max={MAX_SLIPPAGE} step={0.1}
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
            style={{ "--val": `${(slippage / MAX_SLIPPAGE) * 100}%` } as React.CSSProperties}
            className="flex-1"
          />
        </div>
      </div>

      {/* Quote breakdown */}
      {quote && (
        <div className="rounded-xl border border-border px-4 py-3 space-y-2 animate-slide-up">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Estimated Output</span>
            <span className="font-mono text-text">
              {ethers.formatEther(quote.amountOut).slice(0, 12)} {outSym}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted">Price Impact</span>
            <span className={`font-mono font-medium ${impactColor}`}>
              {quote.priceImpact < 0.01 ? "<0.01" : quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted">Min Received ({slippage}% slip)</span>
            <span className="font-mono text-text">
              {ethers.formatEther(
                (quote.amountOut * BigInt(Math.floor((1 - slippage / 100) * 1e6))) / 1000000n
              ).slice(0, 10)} {outSym}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted">Route</span>
            <span className="font-mono text-text">{inSym} → {outSym}</span>
          </div>
          {quote.priceImpact > 5 && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20">
              <p className="text-xs text-danger">
                ⚠ High price impact ({quote.priceImpact.toFixed(1)}%). Your trade may significantly move the market price.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      {needsApproval ? (
        <button className="btn-primary" onClick={handleApprove} disabled={approving || !signer}>
          {approving ? "Approving…" : `Approve ${inSym}`}
        </button>
      ) : (
        <button
          className="btn-primary"
          onClick={handleSwap}
          disabled={busy || !signer || !amountIn || parseFloat(amountIn) <= 0 || !quote}
        >
          {busy ? "Swapping…"
           : !amountIn || parseFloat(amountIn) <= 0 ? "Enter an amount"
           : quoting ? "Fetching quote…"
           : !quote ? "Insufficient liquidity"
           : `Swap ${inSym} → ${outSym}`}
        </button>
      )}

      <TxToast tx={tx} onDismiss={() => setTx({ status: "idle", hash: null, error: null })} />
    </div>
  );
}
