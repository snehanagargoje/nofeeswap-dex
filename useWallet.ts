"use client";
// src/hooks/useWallet.ts
// Manages MetaMask connection, network switching, and transaction state.

import { useState, useEffect, useCallback } from "react";
import { ethers, BrowserProvider, Signer } from "ethers";

export type TxStatus = "idle" | "pending" | "confirmed" | "reverted";

export interface TxState {
  status: TxStatus;
  hash: string | null;
  error: string | null;
}

const LOCAL_CHAIN = {
  chainId:         "0x7a69",           // 31337
  chainName:       "Hardhat Local",
  nativeCurrency:  { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls:         ["http://127.0.0.1:8545"],
  blockExplorerUrls: [],
};

export function useWallet() {
  const [provider, setProvider]   = useState<BrowserProvider | null>(null);
  const [signer, setSigner]       = useState<Signer | null>(null);
  const [address, setAddress]     = useState<string | null>(null);
  const [chainId, setChainId]     = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const isLocalNetwork = chainId === 31337;

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask not detected. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Switch / add local network
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: LOCAL_CHAIN.chainId }],
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [LOCAL_CHAIN],
          });
        }
      }

      const prov   = new ethers.BrowserProvider(window.ethereum);
      const sign   = await prov.getSigner();
      const addr   = await sign.getAddress();
      const net    = await prov.getNetwork();

      setProvider(prov);
      setSigner(sign);
      setAddress(addr);
      setChainId(Number(net.chainId));
    } catch (e: any) {
      setError(e.message ?? "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
  }, []);

  // Listen for account / chain changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const onAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else setAddress(accounts[0]);
    };
    const onChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged",    onChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged",    onChainChanged);
    };
  }, [disconnect]);

  // ---------------------------------------------------------------------------
  // sendTx — wraps a transaction with full pending/confirmed/reverted lifecycle
  // ---------------------------------------------------------------------------
  const sendTx = useCallback(
    async (
      txPromise: Promise<ethers.TransactionResponse>,
      onUpdate?: (state: TxState) => void
    ): Promise<ethers.TransactionReceipt | null> => {
      if (!signer) { setError("Wallet not connected"); return null; }

      const update = (state: TxState) => onUpdate?.(state);
      update({ status: "pending", hash: null, error: null });

      try {
        const tx = await txPromise;
        update({ status: "pending", hash: tx.hash, error: null });

        const receipt = await tx.wait();

        if (receipt && receipt.status === 1) {
          update({ status: "confirmed", hash: tx.hash, error: null });
          return receipt;
        } else {
          update({ status: "reverted", hash: tx.hash, error: "Transaction reverted" });
          return null;
        }
      } catch (e: any) {
        const msg = e?.reason ?? e?.message ?? "Transaction failed";
        update({ status: "reverted", hash: null, error: msg });
        return null;
      }
    },
    [signer]
  );

  return {
    provider,
    signer,
    address,
    chainId,
    connecting,
    error,
    isLocalNetwork,
    connect,
    disconnect,
    sendTx,
  };
}
