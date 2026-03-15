"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle, Link2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";

export default function AssetSettingsPage() {
  const params = useParams();
  const assetIdParam = params.assetId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;

  const asset = useQuery(api.assets.getMyAsset, assetId ? { assetId } : "skip");

  const connectMonday = useMutation(api.mondayConnector.connectMonday);
  const disconnectMonday = useMutation(api.mondayConnector.disconnectMonday);
  const syncPages = useMutation(api.mondayConnector.syncPages);

  const [apiToken, setApiToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isConnected = !!asset?.mondayConnectedAt && !!asset?.mondayBoardId;

  const handleConnect = async () => {
    if (!assetId || !apiToken.trim()) return;

    setIsConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await connectMonday({
        assetId,
        mondayApiToken: apiToken.trim(),
      });

      if (result.success) {
        setSuccess(`Connected! Board ID: ${result.boardId}`);
        setApiToken("");
      } else {
        setError(result.error || "Failed to connect");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!assetId) return;

    setIsDisconnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await disconnectMonday({ assetId });
      if (result.success) {
        setSuccess("Disconnected from Monday.com");
      } else {
        setError("Failed to disconnect");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    if (!assetId) return;

    setIsSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await syncPages({ assetId });
      if (result.success) {
        setSuccess(`Synced ${result.itemCount} pages to Monday.com`);
      } else {
        setError(result.error || "Failed to sync pages");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync pages");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Monday.com Integration
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect to sync discovered pages to a Monday.com board
            </p>
          </div>
        </div>

        <div className="mt-6">
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Connected to Monday.com
                </span>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Board ID
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {asset?.mondayBoardId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Connected at
                  </span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {asset?.mondayConnectedAt
                      ? new Date(asset.mondayConnectedAt).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  {isSyncing ? "Syncing..." : "Sync Pages"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiToken">Monday.com API Token</Label>
                <Input
                  id="apiToken"
                  type="password"
                  placeholder="Enter your Monday.com API token"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  disabled={isConnecting}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Get your API token from Monday.com: Go to your profile &gt;
                  Developer &gt; My Access Tokens
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={isConnecting || !apiToken.trim()}
                className="gap-2"
              >
                <Link2 className="h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Monday.com"}
              </Button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
