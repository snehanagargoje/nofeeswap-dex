"use client";
// src/components/WalletBar.tsx

import type { TxState } from "@/hooks/useWallet";

interface Props {
  address:    string | null;
  chainId:    number | null;
  connecting: boolean;
  onConnect:  () => void;
  onDisconnect: () => void;
}

export default function WalletBar({
  address, chainId, connecting, onConnect, onDisconnect,
}: Props) {
  const isLocal = chainId === 31337;
  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  return (
    <div className="flex items-center gap-3">
      {/* Network badge */}
      {chainId !== null && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono
            ${isLocal
              ? "bg-success/10 text-success border border-success/20"
              : "bg-warn/10 text-warn border border-warn/20"}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isLocal ? "bg-success" : "bg-warn"} animate-pulse`} />
          {isLocal ? "Hardhat Local" : `Chain ${chainId}`}
        </div>
      )}

      {/* Wallet button */}
      {address ? (
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border
                     hover:border-accent/40 hover:bg-accent/5 transition-all text-sm font-mono text-text"
        >
          <span className="w-2 h-2 rounded-full bg-success" />
          {shortAddr}
        </button>
      ) : (
        <button
          onClick={onConnect}
          disabled={connecting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                     text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #7c6fff, #9f7aff)" }}
        >
          {connecting ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round" />
              </svg>
              Connecting…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 40 38" fill="none">
                <path d="M34.98 4.84L21.63 14.57 24.18 8.3 34.98 4.84Z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.01 4.84L18.25 14.66 15.82 8.3 5.01 4.84Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Connect Wallet
            </>
          )}
        </button>
      )}
    </div>
  );
}
