"use client";
// src/components/TxToast.tsx

import { useEffect } from "react";
import type { TxState } from "@/hooks/useWallet";

interface Props {
  tx: TxState;
  onDismiss: () => void;
}

const ICONS: Record<string, string> = {
  pending:   "⏳",
  confirmed: "✅",
  reverted:  "❌",
};

const COLORS: Record<string, string> = {
  pending:   "border-accent/40",
  confirmed: "border-success/40",
  reverted:  "border-danger/40",
};

export default function TxToast({ tx, onDismiss }: Props) {
  useEffect(() => {
    if (tx.status === "confirmed" || tx.status === "reverted") {
      const t = setTimeout(onDismiss, 5000);
      return () => clearTimeout(t);
    }
  }, [tx.status, onDismiss]);

  if (tx.status === "idle") return null;

  const shortHash = tx.hash
    ? `${tx.hash.slice(0, 8)}…${tx.hash.slice(-6)}`
    : null;

  return (
    <div className={`tx-toast ${COLORS[tx.status]}`}>
      <span className="text-2xl">{ICONS[tx.status]}</span>
      <div className="flex flex-col gap-0.5">
        <span className="font-display font-semibold text-sm text-text capitalize">
          {tx.status === "pending" ? "Transaction pending…" :
           tx.status === "confirmed" ? "Transaction confirmed" : "Transaction reverted"}
        </span>
        {shortHash && (
          <span className="font-mono text-xs text-muted">{shortHash}</span>
        )}
        {tx.error && (
          <span className="text-xs text-danger mt-0.5 max-w-[220px] truncate">
            {tx.error}
          </span>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="ml-auto text-muted hover:text-text transition-colors text-lg"
      >
        ×
      </button>
    </div>
  );
}
