"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Upload,
  History,
  Trash2,
  PieChart,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  X,
  FileText,
  DollarSign,
  Layers,
  BarChart3,
  RefreshCw,
} from "lucide-react";

import {
  fetchPortfolios,
  createPortfolio,
  deletePortfolio,
  fetchPortfolioAnalytics,
  fetchPortfolioTransactions,
  addPortfolioTransaction,
  deletePortfolioTransaction,
  importPortfolioCsv,
} from "@/lib/api-client";
import {
  Portfolio,
  PortfolioAnalytics,
  PortfolioHolding,
  PortfolioTransaction,
  TransactionCreatePayload,
} from "@/types/portfolio";
import { DeltaChip } from "@/components/common/DeltaChip";
import { formatINR, formatPercent } from "@/lib/format";

export function PortfolioDashboard() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Form states
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [newPortfolioDesc, setNewPortfolioDesc] = useState("");
  const [tradeForm, setTradeForm] = useState<TransactionCreatePayload>({
    symbol: "",
    transaction_type: "BUY",
    trade_date: new Date().toISOString().split("T")[0],
    quantity: 10,
    price_per_share: 1000,
    brokerage_charges: 20,
    taxes: 10,
    notes: "",
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Initial load
  const loadPortfolios = useCallback(async (selectId?: number) => {
    try {
      setLoading(true);
      const data = await fetchPortfolios();
      setPortfolios(data);

      if (data.length > 0) {
        const targetId = selectId ?? activePortfolioId ?? data[0].id;
        const exists = data.some((p) => p.id === targetId);
        setActivePortfolioId(exists ? targetId : data[0].id);
      } else {
        setActivePortfolioId(null);
        setAnalytics(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load portfolios");
    } finally {
      setLoading(false);
    }
  }, [activePortfolioId]);

  useEffect(() => {
    loadPortfolios();
  }, []);

  // Load analytics and transactions when active portfolio changes
  const loadActivePortfolioDetails = useCallback(async (id: number) => {
    try {
      startTransition(async () => {
        const [analyticsRes, txnsRes] = await Promise.allSettled([
          fetchPortfolioAnalytics(id),
          fetchPortfolioTransactions(id),
        ]);

        if (analyticsRes.status === "fulfilled") {
          setAnalytics(analyticsRes.value);
        }
        if (txnsRes.status === "fulfilled") {
          setTransactions(txnsRes.value);
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load portfolio details");
    }
  }, []);

  useEffect(() => {
    if (activePortfolioId) {
      loadActivePortfolioDetails(activePortfolioId);
    }
  }, [activePortfolioId, loadActivePortfolioDetails]);

  // Handlers
  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    try {
      const created = await createPortfolio({
        name: newPortfolioName.trim(),
        description: newPortfolioDesc.trim() || undefined,
        cash_balance: 0,
      });
      setShowCreateModal(false);
      setNewPortfolioName("");
      setNewPortfolioDesc("");
      setSuccessMsg(`Created portfolio "${created.name}"`);
      await loadPortfolios(created.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create portfolio");
    }
  };

  const handleDeleteActivePortfolio = async () => {
    if (!activePortfolioId) return;
    const current = portfolios.find((p) => p.id === activePortfolioId);
    if (!confirm(`Delete portfolio "${current?.name}" and all historical trades?`)) return;

    try {
      await deletePortfolio(activePortfolioId);
      setSuccessMsg("Portfolio deleted successfully");
      await loadPortfolios();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete portfolio");
    }
  };

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePortfolioId || !tradeForm.symbol?.trim()) return;

    try {
      await addPortfolioTransaction(activePortfolioId, {
        ...tradeForm,
        symbol: tradeForm.symbol.trim().toUpperCase(),
        quantity: tradeForm.quantity ? Number(tradeForm.quantity) : undefined,
        price_per_share: tradeForm.price_per_share ? Number(tradeForm.price_per_share) : undefined,
        amount: tradeForm.amount ? Number(tradeForm.amount) : undefined,
        brokerage_charges: Number(tradeForm.brokerage_charges || 0),
        taxes: Number(tradeForm.taxes || 0),
      });
      setShowTradeModal(false);
      setSuccessMsg(`Logged ${tradeForm.transaction_type} trade for ${tradeForm.symbol.toUpperCase()}`);
      loadActivePortfolioDetails(activePortfolioId);
      loadPortfolios(activePortfolioId);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log trade");
    }
  };

  const handleDeleteTransaction = async (txnId: number) => {
    if (!activePortfolioId) return;
    if (!confirm("Delete this transaction? Open lot calculations will be automatically updated.")) return;

    try {
      await deletePortfolioTransaction(activePortfolioId, txnId);
      setSuccessMsg("Transaction deleted");
      loadActivePortfolioDetails(activePortfolioId);
      loadPortfolios(activePortfolioId);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete transaction");
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePortfolioId || !csvFile) return;

    try {
      setCsvStatus("Uploading and reconciling trades...");
      const res = await importPortfolioCsv(activePortfolioId, csvFile);
      setCsvStatus(
        `Imported ${res.imported_count} trades. Skipped ${res.skipped_count} duplicates.${
          res.errors.length > 0 ? ` (${res.errors.length} warnings)` : ""
        }`
      );
      setSuccessMsg(`Import complete: ${res.imported_count} trades added`);
      setTimeout(() => {
        setShowImportModal(false);
        setCsvFile(null);
        setCsvStatus(null);
        loadActivePortfolioDetails(activePortfolioId);
        loadPortfolios(activePortfolioId);
      }, 1500);
    } catch (err: any) {
      setCsvStatus(`Error: ${err.message || "CSV Import failed"}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notifications */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-card border border-[var(--down)]/30 bg-[var(--down)]/10 px-4 py-3 text-sm text-[var(--down)] shadow-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="p-1 hover:opacity-70"
            aria-label="Dismiss error notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-center justify-between rounded-card border border-[var(--up)]/30 bg-[var(--up)]/10 px-4 py-3 text-sm text-[var(--up)] shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="p-1 hover:opacity-70"
            aria-label="Dismiss success notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header & Portfolio Switcher Ribbon */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-1)]">
            Portfolio Analytics & Tracking
          </h1>
          <p className="text-xs text-[var(--text-2)]">
            Tax-compliant FIFO cost basis, ACT/365 money-weighted returns (XIRR), and NIFTY 50 benchmark regression.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {activePortfolioId && (
            <>
              <button
                onClick={() => setShowTradeModal(true)}
                className="apple-btn inline-flex items-center gap-1.5 rounded-pill bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-105"
                aria-label="Log a new trade"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Log Trade</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="apple-btn inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-[var(--text-1)] shadow-sm hover:bg-[var(--hover)]"
                aria-label="Upload broker tradebook CSV"
              >
                <Upload className="h-3.5 w-3.5 text-[var(--text-2)]" />
                <span>Import CSV</span>
              </button>
              <button
                onClick={() => setShowLedgerModal(true)}
                className="apple-btn inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-[var(--text-1)] shadow-sm hover:bg-[var(--hover)]"
                aria-label="Open transaction ledger"
              >
                <History className="h-3.5 w-3.5 text-[var(--text-2)]" />
                <span>Ledger ({transactions.length})</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="apple-btn inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-[var(--text-1)] shadow-sm hover:bg-[var(--hover)]"
            aria-label="Create new portfolio"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>New Portfolio</span>
          </button>
        </div>
      </div>

      {/* Portfolio Selector Segmented Pills */}
      {portfolios.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Portfolios">
          {portfolios.map((p) => {
            const isActive = p.id === activePortfolioId;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActivePortfolioId(p.id)}
                className={`apple-btn inline-flex items-center gap-2 rounded-pill px-4 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                    : "border border-hairline bg-surface text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text-1)]"
                }`}
              >
                <span>{p.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isActive ? "bg-white/20 text-white" : "bg-[var(--track)] text-[var(--text-3)]"
                  }`}
                >
                  {p.holdings_count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="apple-panel flex h-64 items-center justify-center p-8 text-[var(--text-2)]">
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 animate-spin text-[var(--accent)]" />
            <span>Loading portfolio intelligence...</span>
          </div>
        </div>
      ) : portfolios.length === 0 ? (
        /* Empty State */
        <div className="apple-panel flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
            <PieChart className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-1)]">No Portfolios Found</h2>
          <p className="mt-1 max-w-sm text-xs text-[var(--text-2)]">
            Create your first equity portfolio or import historical tradebooks from Zerodha Kite or Groww.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="apple-btn mt-5 inline-flex items-center gap-1.5 rounded-pill bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-105"
          >
            <Plus className="h-4 w-4" />
            <span>Create Portfolio</span>
          </button>
        </div>
      ) : analytics ? (
        /* Active Portfolio View */
        <div className="space-y-6">
          {/* Top Performance Ribbon (Cards) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* Total Net Worth */}
            <div className="apple-card p-4">
              <span className="text-[11px] font-medium text-[var(--text-2)] uppercase tracking-wider">
                Total Net Worth
              </span>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-1)]">
                {formatINR(analytics.total_net_worth)}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-3)]">
                Stocks + Uninvested Cash
              </div>
            </div>

            {/* Invested Capital */}
            <div className="apple-card p-4">
              <span className="text-[11px] font-medium text-[var(--text-2)] uppercase tracking-wider">
                Invested Capital
              </span>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-1)]">
                {formatINR(analytics.invested_capital)}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-3)]">
                FIFO Cost Basis
              </div>
            </div>

            {/* Unrealized P&L */}
            <div className="apple-card p-4">
              <span className="text-[11px] font-medium text-[var(--text-2)] uppercase tracking-wider">
                Unrealized P&L
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    analytics.unrealized_pnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                  }`}
                >
                  {formatINR(analytics.unrealized_pnl)}
                </span>
              </div>
              <div className="mt-1">
                <DeltaChip percentage={analytics.unrealized_pnl_pct} />
              </div>
            </div>

            {/* Realized P&L */}
            <div className="apple-card p-4">
              <span className="text-[11px] font-medium text-[var(--text-2)] uppercase tracking-wider">
                Realized P&L
              </span>
              <div
                className={`mt-1 text-lg font-semibold tabular-nums ${
                  analytics.realized_pnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                }`}
              >
                {formatINR(analytics.realized_pnl)}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-3)]">
                Sec 55 Tax Matched
              </div>
            </div>

            {/* Portfolio XIRR */}
            <div className="apple-card p-4">
              <span className="text-[11px] font-medium text-[var(--text-2)] uppercase tracking-wider">
                Portfolio XIRR
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums text-[var(--accent)]">
                  {analytics.portfolio_xirr != null
                    ? `${(analytics.portfolio_xirr * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
                <span className="text-[10px] text-[var(--text-3)]">p.a.</span>
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-3)]">
                ACT/365 Cash-Flow Return
              </div>
            </div>

            {/* Benchmark Beta & Alpha */}
            <div className="apple-card p-4">
              <span className="text-[11px] font-medium text-[var(--text-2)] uppercase tracking-wider">
                Risk & Benchmark
              </span>
              <div className="mt-1 flex items-center gap-3 tabular-nums text-sm font-semibold text-[var(--text-1)]">
                <div>
                  <span className="text-[10px] font-normal text-[var(--text-3)]">Beta </span>
                  {analytics.beta ?? "1.00"}
                </div>
                <div>
                  <span className="text-[10px] font-normal text-[var(--text-3)]">Alpha </span>
                  {analytics.alpha != null ? `${(analytics.alpha * 100).toFixed(1)}%` : "0.0%"}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-3)]">
                vs NIFTY 50 ({analytics.benchmark_symbol})
              </div>
            </div>
          </div>

          {/* Holdings Table */}
          <div className="apple-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-1)]">
                  Active Holdings ({analytics.holdings.length})
                </h2>
                <p className="text-xs text-[var(--text-2)]">
                  Cash Balance: <span className="font-semibold text-[var(--text-1)]">{formatINR(analytics.cash_balance)}</span>
                </p>
              </div>

              <button
                onClick={handleDeleteActivePortfolio}
                className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--down)]"
                title="Delete this portfolio"
              >
                Delete Portfolio
              </button>
            </div>

            {analytics.holdings.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-2)]">
                No active holdings. Click <span className="font-semibold text-[var(--accent)]">Log Trade</span> or{" "}
                <span className="font-semibold text-[var(--accent)]">Import CSV</span> to track your positions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-hairline bg-[var(--hover)] text-[11px] font-medium text-[var(--text-2)]">
                      <th className="px-5 py-3">Security</th>
                      <th className="px-4 py-3 text-right">Shares</th>
                      <th className="px-4 py-3 text-right">Avg Cost</th>
                      <th className="px-4 py-3 text-right">CMP</th>
                      <th className="px-4 py-3 text-right">Current Value</th>
                      <th className="px-4 py-3 text-right">Unrealized P&L</th>
                      <th className="px-4 py-3 text-right">Holding XIRR</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {analytics.holdings.map((h) => (
                      <tr key={h.security_id} className="transition-colors hover:bg-[var(--hover)]">
                        {/* Security Symbol & Company Name */}
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/companies/${h.company_id}`}
                            className="font-semibold text-[var(--text-1)] hover:text-[var(--accent)]"
                          >
                            {h.symbol}
                          </Link>
                          <div className="text-[11px] text-[var(--text-3)] truncate max-w-[200px]">
                            {h.company_name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                            <span className="rounded-full bg-[var(--track)] px-1.5 py-0.2 text-[var(--text-2)]">
                              {h.sector_name}
                            </span>
                            <span className="rounded-full bg-[var(--track)] px-1.5 py-0.2 text-[var(--text-3)]">
                              {h.market_cap_category}
                            </span>
                          </div>
                        </td>

                        {/* Shares */}
                        <td className="px-4 py-3.5 text-right font-mono font-medium tabular-nums text-[var(--text-1)]">
                          {h.total_quantity}
                        </td>

                        {/* Avg Cost */}
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[var(--text-2)]">
                          {formatINR(h.average_buy_price)}
                        </td>

                        {/* Current Market Price */}
                        <td className="px-4 py-3.5 text-right font-mono font-medium tabular-nums text-[var(--text-1)]">
                          {h.current_price ? formatINR(h.current_price) : "N/A"}
                        </td>

                        {/* Current Value */}
                        <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[var(--text-1)]">
                          {formatINR(h.current_value)}
                        </td>

                        {/* Unrealized P&L */}
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <div
                            className={`font-mono font-semibold ${
                              h.unrealized_pnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                            }`}
                          >
                            {formatINR(h.unrealized_pnl)}
                          </div>
                          <div className="mt-0.5">
                            <DeltaChip percentage={h.unrealized_pnl_pct} />
                          </div>
                        </td>

                        {/* Holding XIRR */}
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[var(--text-1)]">
                          {h.holding_xirr != null ? (
                            <span
                              className={`font-semibold ${
                                h.holding_xirr >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                              }`}
                            >
                              {(h.holding_xirr * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[var(--text-3)]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setTradeForm({
                                  symbol: h.symbol,
                                  transaction_type: "SELL",
                                  trade_date: new Date().toISOString().split("T")[0],
                                  quantity: h.total_quantity,
                                  price_per_share: h.current_price || h.average_buy_price,
                                  brokerage_charges: 20,
                                  taxes: 10,
                                  notes: "Exit position",
                                });
                                setShowTradeModal(true);
                              }}
                              className="rounded-pill border border-hairline px-2.5 py-1 text-[11px] font-medium text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--down)]"
                            >
                              Sell
                            </button>
                            <Link
                              href={`/companies/${h.company_id}`}
                              className="rounded-pill p-1 text-[var(--text-3)] hover:text-[var(--accent)]"
                              title="View full research dossier"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Asset Allocation Breakdown (Sectors & Market Caps) */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Sector Allocation */}
            <div className="apple-card p-5">
              <div className="flex items-center justify-between pb-3 border-b border-hairline">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[var(--accent)]" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-1)]">
                    Sector Allocation
                  </h3>
                </div>
                <span className="text-[11px] text-[var(--text-3)]">
                  {analytics.sectors.length} Sectors
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {analytics.sectors.length === 0 ? (
                  <p className="text-xs text-[var(--text-3)]">No holdings to allocate.</p>
                ) : (
                  analytics.sectors.map((s) => (
                    <div key={s.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[var(--text-1)]">{s.name}</span>
                        <span className="font-mono tabular-nums text-[var(--text-2)]">
                          {formatINR(s.value)} ({s.weight_pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--track)]">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(s.weight_pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Market Cap Category Allocation */}
            <div className="apple-card p-5">
              <div className="flex items-center justify-between pb-3 border-b border-hairline">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-1)]">
                    Market Cap Allocation
                  </h3>
                </div>
                <span className="text-[11px] text-[var(--text-3)]">
                  Cap Tiers
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {analytics.market_caps.length === 0 ? (
                  <p className="text-xs text-[var(--text-3)]">No holdings to allocate.</p>
                ) : (
                  analytics.market_caps.map((m) => (
                    <div key={m.tier} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[var(--text-1)]">{m.tier}</span>
                        <span className="font-mono tabular-nums text-[var(--text-2)]">
                          {formatINR(m.value)} ({m.weight_pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--track)]">
                        <div
                          className="h-full bg-[var(--indigo)] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(m.weight_pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 1. Create Portfolio Modal                                */}
      {/* ───────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="apple-card w-full max-w-md p-6 shadow-overlay animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">Create New Portfolio</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-[var(--text-3)] hover:text-[var(--text-1)]"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePortfolio} className="mt-4 space-y-4">
              <div>
                <label htmlFor="portfolio-name-input" className="block text-xs font-medium text-[var(--text-2)]">
                  Portfolio Name *
                </label>
                <input
                  id="portfolio-name-input"
                  type="text"
                  required
                  placeholder="e.g. Core Long-Term Compounders"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-xs text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="portfolio-desc-input" className="block text-xs font-medium text-[var(--text-2)]">
                  Description (Optional)
                </label>
                <textarea
                  id="portfolio-desc-input"
                  rows={2}
                  placeholder="Strategy thesis, benchmark, or investment objectives"
                  value={newPortfolioDesc}
                  onChange={(e) => setNewPortfolioDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-xs text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="apple-btn rounded-pill border border-hairline px-3.5 py-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apple-btn rounded-pill bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-105"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 2. Log Trade Modal                                       */}
      {/* ───────────────────────────────────────────────────────── */}
      {showTradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="apple-card w-full max-w-lg p-6 shadow-overlay animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">Log Portfolio Transaction</h3>
              <button
                onClick={() => setShowTradeModal(false)}
                className="p-1 text-[var(--text-3)] hover:text-[var(--text-1)]"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddTrade} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                {/* Transaction Type */}
                <div>
                  <label htmlFor="txn-type-select" className="block text-xs font-medium text-[var(--text-2)]">
                    Type *
                  </label>
                  <select
                    id="txn-type-select"
                    value={tradeForm.transaction_type}
                    onChange={(e) => setTradeForm({ ...tradeForm, transaction_type: e.target.value })}
                    className="mt-1 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-xs font-medium text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="BUY">BUY (Stock Purchase)</option>
                    <option value="SELL">SELL (Lot Liquidation)</option>
                    <option value="BONUS">BONUS (Sec 55 ₹0 Lot)</option>
                    <option value="SPLIT">SPLIT (Ratio Subdivision)</option>
                    <option value="DIVIDEND">DIVIDEND (Cash Inflow)</option>
                    <option value="DEPOSIT">DEPOSIT (Cash Inflow)</option>
                    <option value="WITHDRAWAL">WITHDRAWAL (Cash Outflow)</option>
                  </select>
                </div>

                {/* Symbol */}
                <div>
                  <label htmlFor="txn-symbol-input" className="block text-xs font-medium text-[var(--text-2)]">
                    Symbol (NSE/BSE) *
                  </label>
                  <input
                    id="txn-symbol-input"
                    type="text"
                    required={!["DEPOSIT", "WITHDRAWAL"].includes(tradeForm.transaction_type)}
                    placeholder="e.g. RELIANCE, TCS, HDFCBANK"
                    value={tradeForm.symbol}
                    onChange={(e) => setTradeForm({ ...tradeForm, symbol: e.target.value.toUpperCase() })}
                    className="mt-1 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-xs font-mono font-medium text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Trade Date */}
                <div>
                  <label htmlFor="txn-date-input" className="block text-xs font-medium text-[var(--text-2)]">
                    Date *
                  </label>
                  <input
                    id="txn-date-input"
                    type="date"
                    required
                    value={tradeForm.trade_date}
                    onChange={(e) => setTradeForm({ ...tradeForm, trade_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-xs text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label htmlFor="txn-qty-input" className="block text-xs font-medium text-[var(--text-2)]">
                    Quantity
                  </label>
                  <input
                    id="txn-qty-input"
                    type="number"
                    step="any"
                    value={tradeForm.quantity ?? ""}
                    onChange={(e) => setTradeForm({ ...tradeForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-xs font-mono text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>

                {/* Price Per Share */}
                <div>
                  <label htmlFor="txn-price-input" className="block text-xs font-medium text-[var(--text-2)]">
                    Price (₹)
                  </label>
                  <input
                    id="txn-price-input"
                    type="number"
                    step="0.05"
                    value={tradeForm.price_per_share ?? ""}
                    onChange={(e) => setTradeForm({ ...tradeForm, price_per_share: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-xs font-mono text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Estimated Cash Impact */}
              <div className="rounded-md bg-[var(--hover)] p-3 text-xs text-[var(--text-2)] flex items-center justify-between">
                <span>Estimated Value:</span>
                <span className="font-mono font-semibold text-[var(--text-1)]">
                  {formatINR(Number(tradeForm.quantity || 0) * Number(tradeForm.price_per_share || 0))}
                </span>
              </div>

              <div>
                <label htmlFor="txn-notes-input" className="block text-xs font-medium text-[var(--text-2)]">
                  Notes / Trade Rationale
                </label>
                <input
                  id="txn-notes-input"
                  type="text"
                  placeholder="e.g. Quarterly SIP accumulation, profit target met"
                  value={tradeForm.notes}
                  onChange={(e) => setTradeForm({ ...tradeForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-xs text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTradeModal(false)}
                  className="apple-btn rounded-pill border border-hairline px-3.5 py-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apple-btn rounded-pill bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-105"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 3. CSV Import Modal                                      */}
      {/* ───────────────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="apple-card w-full max-w-md p-6 shadow-overlay animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">Import Broker CSV Tradebook</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 text-[var(--text-3)] hover:text-[var(--text-1)]"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleImportCsv} className="mt-4 space-y-4">
              <p className="text-xs text-[var(--text-2)]">
                Upload your tradebook export from <strong>Zerodha Kite</strong> or <strong>Groww</strong>. Duplicate trades are automatically skipped.
              </p>

              <div className="rounded-lg border-2 border-dashed border-hairline p-6 text-center hover:bg-[var(--hover)] transition-colors">
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer block">
                  <Upload className="mx-auto h-8 w-8 text-[var(--accent)]" />
                  <span className="mt-2 block text-xs font-medium text-[var(--text-1)]">
                    {csvFile ? csvFile.name : "Select a .csv tradebook file"}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[var(--text-3)]">
                    Kite: Console &gt; Tradebook &gt; Download CSV
                  </span>
                </label>
              </div>

              {csvStatus && (
                <div className="rounded-md bg-[var(--hover)] p-2.5 text-xs text-[var(--text-1)]">
                  {csvStatus}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="apple-btn rounded-pill border border-hairline px-3.5 py-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!csvFile}
                  className="apple-btn rounded-pill bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
                >
                  Import Trades
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* 4. Transaction Ledger Modal                               */}
      {/* ───────────────────────────────────────────────────────── */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="apple-card w-full max-w-3xl max-h-[80vh] flex flex-col p-6 shadow-overlay animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-1)]">
                  Transaction Ledger ({transactions.length})
                </h3>
                <p className="text-xs text-[var(--text-2)]">Chronological audit log of all trade allocations</p>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="p-1 text-[var(--text-3)] hover:text-[var(--text-1)]"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="p-8 text-center text-xs text-[var(--text-3)]">No transactions recorded yet.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-hairline bg-[var(--hover)] text-[11px] font-medium text-[var(--text-2)]">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2 text-right">Shares</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Total Cash</th>
                      <th className="px-3 py-2 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-[var(--hover)]">
                        <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-2)]">{t.trade_date}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              t.transaction_type === "BUY"
                                ? "bg-[var(--up)]/10 text-[var(--up)]"
                                : t.transaction_type === "SELL"
                                ? "bg-[var(--down)]/10 text-[var(--down)]"
                                : "bg-[var(--track)] text-[var(--text-2)]"
                            }`}
                          >
                            {t.transaction_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-[var(--text-1)]">{t.symbol || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-1)]">
                          {t.quantity ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-2)]">
                          {t.price_per_share ? formatINR(t.price_per_share) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium tabular-nums text-[var(--text-1)]">
                          {formatINR(t.amount)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="p-1 text-[var(--text-3)] hover:text-[var(--down)]"
                            title="Delete transaction"
                            aria-label={`Delete transaction ${t.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
