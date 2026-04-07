"use client";
// src/components/KernelEditor.tsx
//
// Visual editor for the NoFeeSwap kernel — the piecewise-linear liquidity
// distribution shape over log-price space.
//
// Each breakpoint = { logPrice (X59.96), sqrtOffset (X96) }
// The kernel defines how liquidity is concentrated across price intervals.
// A flat sqrtOffset = 1 means uniform (Uniswap v2-like) distribution.
// Higher sqrtOffset = more concentrated liquidity at that price point.

import { useState, useCallback, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { encodeLogPrice, Q96 } from "@/lib/contracts";

export interface KernelBreakpoint {
  logPrice:   bigint; // X59.96
  sqrtOffset: bigint; // X96 — treated as relative liquidity weight
  // display helpers (not encoded)
  price:      number;
  weight:     number; // 0–100 slider value → maps to sqrtOffset
}

interface Props {
  breakpoints: KernelBreakpoint[];
  onChange:    (bp: KernelBreakpoint[]) => void;
  currentPrice?: number;
}

// ---- Presets ---------------------------------------------------------------
export const KERNEL_PRESETS: Record<string, KernelBreakpoint[]> = {
  "Uniform (V2-like)": makePreset([
    { price: 0.0625, weight: 50 },
    { price: 16,     weight: 50 },
  ]),
  "Concentrated ±5%": makePreset([
    { price: 0.5,   weight: 5  },
    { price: 0.9,   weight: 20 },
    { price: 1.0,   weight: 100},
    { price: 1.1,   weight: 20 },
    { price: 2.0,   weight: 5  },
  ]),
  "Skewed (bullish)": makePreset([
    { price: 0.5,  weight: 10 },
    { price: 1.0,  weight: 40 },
    { price: 2.0,  weight: 100},
    { price: 4.0,  weight: 60 },
    { price: 8.0,  weight: 10 },
  ]),
  "V-shape (range)": makePreset([
    { price: 0.5,  weight: 80 },
    { price: 1.0,  weight: 10 },
    { price: 2.0,  weight: 80 },
  ]),
};

function makePreset(pts: { price: number; weight: number }[]): KernelBreakpoint[] {
  return pts.map(({ price, weight }) => ({
    logPrice:   encodeLogPrice(price),
    sqrtOffset: weightToSqrtOffset(weight),
    price,
    weight,
  }));
}

function weightToSqrtOffset(w: number): bigint {
  // map 0-100 → (0.1 * Q96) to (2 * Q96)
  const scale = 0.1 + (w / 100) * 1.9;
  return BigInt(Math.floor(scale * Number(Q96)));
}

// ---------------------------------------------------------------------------

export default function KernelEditor({ breakpoints, onChange, currentPrice = 1.0 }: Props) {
  const [preset, setPreset] = useState("Uniform (V2-like)");
  const [dragging, setDragging] = useState<number | null>(null);

  // Chart data — convert breakpoints to chart-friendly format
  const chartData = breakpoints.map((bp) => ({
    price:  bp.price,
    weight: bp.weight,
    label:  bp.price < 0.01
      ? bp.price.toFixed(4)
      : bp.price < 1
      ? bp.price.toFixed(3)
      : bp.price.toFixed(2),
  }));

  const applyPreset = (name: string) => {
    setPreset(name);
    onChange(KERNEL_PRESETS[name]);
  };

  const updateWeight = (idx: number, w: number) => {
    const next = breakpoints.map((bp, i) =>
      i === idx
        ? { ...bp, weight: w, sqrtOffset: weightToSqrtOffset(w) }
        : bp
    );
    onChange(next);
  };

  const addBreakpoint = () => {
    const lastPrice = breakpoints[breakpoints.length - 1]?.price ?? 1;
    const newPrice  = Math.min(lastPrice * 1.5, 16);
    const newBp: KernelBreakpoint = {
      logPrice:   encodeLogPrice(newPrice),
      sqrtOffset: weightToSqrtOffset(50),
      price:      newPrice,
      weight:     50,
    };
    const next = [...breakpoints, newBp].sort((a, b) => a.price - b.price);
    onChange(next);
  };

  const removeBreakpoint = (idx: number) => {
    if (breakpoints.length <= 2) return; // minimum 2 breakpoints
    onChange(breakpoints.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-sm text-text">
            Liquidity Kernel
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Shape of liquidity distribution across price intervals
          </p>
        </div>
        <button
          onClick={addBreakpoint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     border border-accent/30 text-accent hover:bg-accent/10 transition-all"
        >
          <span className="text-base leading-none">+</span> Add point
        </button>
      </div>

      {/* Presets */}
      <div className="flex gap-2 flex-wrap">
        {Object.keys(KERNEL_PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              preset === name
                ? "bg-accent/20 text-accent border border-accent/40"
                : "bg-surface text-muted border border-border hover:text-text"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div
        className="rounded-xl overflow-hidden border border-border"
        style={{ background: "rgba(10,10,15,0.6)" }}
      >
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="kGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7c6fff" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#7c6fff" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#7070a0", fontSize: 10, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 110]}
              tick={{ fill: "#7070a0", fontSize: 10, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a26",
                border: "1px solid #2a2a3d",
                borderRadius: 10,
                fontFamily: "DM Mono",
                fontSize: 12,
              }}
              labelStyle={{ color: "#7070a0" }}
              itemStyle={{ color: "#7c6fff" }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "Weight"]}
            />
            <ReferenceLine
              x={currentPrice < 0.01 ? currentPrice.toFixed(4) : currentPrice.toFixed(2)}
              stroke="#ff6f91"
              strokeDasharray="4 4"
              label={{ value: "current", fill: "#ff6f91", fontSize: 9, fontFamily: "DM Mono" }}
            />
            <Area
              type="monotone"
              dataKey="weight"
              stroke="#7c6fff"
              strokeWidth={2}
              fill="url(#kGrad)"
              dot={{ fill: "#7c6fff", r: 4, strokeWidth: 2, stroke: "#0a0a0f" }}
              activeDot={{ r: 6, fill: "#9f7aff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Breakpoint sliders */}
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {breakpoints.map((bp, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border
                       bg-surface/50 hover:border-accent/20 transition-colors group"
          >
            {/* Price label */}
            <span className="font-mono text-xs text-accent w-14 shrink-0">
              {bp.price < 0.01
                ? bp.price.toFixed(4)
                : bp.price < 1
                ? bp.price.toFixed(3)
                : bp.price.toFixed(2)}×
            </span>

            {/* Weight slider */}
            <div className="flex-1 relative">
              <input
                type="range"
                min={1}
                max={100}
                value={bp.weight}
                onChange={(e) => updateWeight(idx, Number(e.target.value))}
                style={{ "--val": `${bp.weight}%` } as React.CSSProperties}
                className="w-full"
              />
            </div>

            {/* Weight value */}
            <span className="font-mono text-xs text-muted w-10 text-right shrink-0">
              {bp.weight}%
            </span>

            {/* Remove */}
            <button
              onClick={() => removeBreakpoint(idx)}
              disabled={breakpoints.length <= 2}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger
                         transition-all disabled:opacity-0 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">
        Kernel encodes how liquidity is weighted across price points. Higher weight = more
        concentrated liquidity at that price. Minimum 2 breakpoints required.
      </p>
    </div>
  );
}
