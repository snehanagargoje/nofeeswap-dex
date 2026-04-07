// src/pages/index.tsx
//
// NoFeeSwap dApp — Main page
// Assembles: WalletBar, PoolStats, and the four feature panels
// (Initialize Pool, Add/Remove Liquidity, Swap)

import Head from "next/head";
import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { usePool }   from "@/hooks/usePool";
import WalletBar       from "@/components/WalletBar";
import PoolStats        from "@/components/PoolStats";
import InitializePool   from "@/components/InitializePool";
import ManageLiquidity  from "@/components/ManageLiquidity";
import SwapPanel        from "@/components/SwapPanel";

type Tab = "initialize" | "liquidity" | "swap";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "initialize", label: "Initialize Pool", icon: "⚗" },
  { id: "liquidity",  label: "Manage Liquidity", icon: "💧" },
  { id: "swap",       label: "Swap",             icon: "⇄"  },
];

export default function Home() {
  const wallet = useWallet();
  const pool   = usePool(wallet.signer);
  const [tab, setTab] = useState<Tab>("swap");

  const handleSuccess = useCallback(() => {
    setTimeout(() => pool.refresh(), 1200);
  }, [pool]);

  return (
    <>
      <Head>
        <title>NoFeeSwap — Local DEX</title>
        <meta name="description" content="NoFeeSwap local development dApp" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Animated background mesh */}
      <div className="mesh-bg" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-border/60"
                style={{ background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)" }}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-sm text-white"
                   style={{ background: "linear-gradient(135deg, #7c6fff, #ff6f91)" }}>
                N
              </div>
              <div>
                <span className="font-display font-bold text-base text-text">NoFeeSwap</span>
                <span className="ml-2 text-xs text-muted font-mono">Local Dev</span>
              </div>
            </div>

            {/* Network warning */}
            {wallet.address && !wallet.isLocalNetwork && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg
                              bg-warn/10 border border-warn/20 text-xs text-warn">
                ⚠ Switch to Hardhat Local (Chain 31337)
              </div>
            )}

            <WalletBar
              address={wallet.address}
              chainId={wallet.chainId}
              connecting={wallet.connecting}
              onConnect={wallet.connect}
              onDisconnect={wallet.disconnect}
            />
          </div>
        </header>

        {/* ── Main ───────────────────────────────────────────── */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
          {/* Welcome banner (shown when not connected) */}
          {!wallet.address && (
            <div className="mb-8 rounded-3xl border border-accent/20 p-8 text-center space-y-4"
                 style={{ background: "rgba(124,111,255,0.06)" }}>
              <div className="text-5xl">⚗</div>
              <h1 className="font-display font-black text-3xl text-text">
                NoFeeSwap Local Environment
              </h1>
              <p className="text-muted max-w-lg mx-auto text-sm leading-relaxed">
                A zero-spread AMM with customizable liquidity kernels.
                Connect your MetaMask wallet pointed at <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded">localhost:8545</code> to get started.
              </p>
              <button
                onClick={wallet.connect}
                disabled={wallet.connecting}
                className="btn-primary max-w-xs mx-auto block mt-2"
              >
                {wallet.connecting ? "Connecting…" : "Connect MetaMask"}
              </button>
            </div>
          )}

          {wallet.error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">
              {wallet.error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-6">
            {/* ── Left column: pool stats ── */}
            <aside className="space-y-4">
              <PoolStats
                poolState={pool.poolState}
                balances={pool.balances}
                poolId={pool.poolId}
                loading={pool.loading}
                onRefresh={pool.refresh}
              />

              {/* Setup guide */}
              <div className="rounded-2xl border border-border p-4 space-y-3"
                   style={{ background: "rgba(26,26,38,0.6)" }}>
                <h3 className="font-display font-semibold text-sm text-text">Setup Guide</h3>
                <ol className="space-y-2">
                  {[
                    { n: 1, text: "Start Anvil: anvil --port 8545" },
                    { n: 2, text: "Clone NoFeeSwap/core + operator" },
                    { n: 3, text: "Run: npm run deploy:all" },
                    { n: 4, text: "Add Hardhat Local to MetaMask" },
                    { n: 5, text: "Import deployer private key" },
                  ].map(({ n, text }) => (
                    <li key={n} className="flex gap-2.5 items-start">
                      <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-xs
                                       font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {n}
                      </span>
                      <span className="text-xs text-muted leading-relaxed">{text}</span>
                    </li>
                  ))}
                </ol>
                <div className="pt-1 border-t border-border">
                  <p className="text-xs text-muted">
                    Default test key:{" "}
                    <code className="text-accent text-xs">0xac09…f2ff80</code>
                  </p>
                </div>
              </div>
            </aside>

            {/* ── Right column: action panels ── */}
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1.5 p-1 rounded-2xl border border-border"
                   style={{ background: "rgba(18,18,26,0.9)" }}>
                {TABS.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`tab flex-1 flex items-center justify-center gap-2 ${tab === id ? "active" : ""}`}
                  >
                    <span>{icon}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Panel card */}
              <div className="rounded-3xl border border-border p-6"
                   style={{ background: "rgba(18,18,26,0.95)", backdropFilter: "blur(20px)" }}>
                {tab === "initialize" && (
                  <div>
                    <div className="mb-5">
                      <h2 className="font-display font-bold text-xl text-text">Initialize Pool</h2>
                      <p className="text-sm text-muted mt-1">
                        Create a new liquidity pool with a custom kernel shape.
                      </p>
                    </div>
                    <InitializePool
                      signer={wallet.signer}
                      sendTx={wallet.sendTx}
                      onSuccess={handleSuccess}
                    />
                  </div>
                )}

                {tab === "liquidity" && (
                  <div>
                    <div className="mb-5">
                      <h2 className="font-display font-bold text-xl text-text">Manage Liquidity</h2>
                      <p className="text-sm text-muted mt-1">
                        Add or remove liquidity from the active pool.
                      </p>
                    </div>
                    <ManageLiquidity
                      signer={wallet.signer}
                      sendTx={wallet.sendTx}
                      poolState={pool.poolState}
                      balances={pool.balances}
                      poolId={pool.poolId}
                      onSuccess={handleSuccess}
                    />
                  </div>
                )}

                {tab === "swap" && (
                  <div>
                    <div className="mb-5">
                      <h2 className="font-display font-bold text-xl text-text">Swap Tokens</h2>
                      <p className="text-sm text-muted mt-1">
                        Trade between TOKEN_A and TOKEN_B with zero spread.
                      </p>
                    </div>
                    <SwapPanel
                      signer={wallet.signer}
                      sendTx={wallet.sendTx}
                      poolState={pool.poolState}
                      balances={pool.balances}
                      poolId={pool.poolId}
                      onSuccess={handleSuccess}
                    />
                  </div>
                )}

                {!wallet.address && (
                  <div className="mt-6 pt-6 border-t border-border text-center">
                    <p className="text-sm text-muted">Connect your wallet to interact with the protocol.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 py-5 text-center">
          <p className="text-xs text-muted">
            NoFeeSwap Local Dev Environment ·{" "}
            <a href="https://github.com/NoFeeSwap/core" target="_blank" rel="noreferrer"
               className="text-accent hover:underline">Core</a>
            {" · "}
            <a href="https://github.com/NoFeeSwap/operator" target="_blank" rel="noreferrer"
               className="text-accent hover:underline">Operator</a>
            {" · "}
            <a href="https://github.com/NoFeeSwap/docs" target="_blank" rel="noreferrer"
               className="text-accent hover:underline">YellowPaper</a>
          </p>
        </footer>
      </div>
    </>
  );
}
