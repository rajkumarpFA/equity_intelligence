"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  Plus,
  Trash2,
  Edit2,
  Star,
  Search,
  ExternalLink,
  Target,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  FolderPlus,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import {
  fetchWatchlists,
  createWatchlist,
  deleteWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  removeWatchlistItem,
  fetchCompanySearch,
  fetchCompanyById,
} from "@/lib/api-client";
import type { Watchlist, WatchlistItem } from "@/types/workflow";
import type { CompanySearchItem } from "@/types/company";

export function WatchlistView() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isNewWatchlistOpen, setIsNewWatchlistOpen] = useState(false);
  const [newWlName, setNewWlName] = useState("");
  const [newWlDesc, setNewWlDesc] = useState("");
  const [newWlColor, setNewWlColor] = useState("#00d992");

  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemSearchResults, setItemSearchResults] = useState<CompanySearchItem[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [selectedStock, setSelectedStock] = useState<CompanySearchItem | null>(null);
  const [entryTarget, setEntryTarget] = useState<string>("");
  const [exitTarget, setExitTarget] = useState<string>("");
  const [conviction, setConviction] = useState<number>(3);
  const [thesisSummary, setThesisSummary] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Edit item modal
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
  const [editEntry, setEditEntry] = useState<string>("");
  const [editExit, setEditExit] = useState<string>("");
  const [editConviction, setEditConviction] = useState<number>(3);
  const [editNotes, setEditNotes] = useState<string>("");

  // Filter / Sort
  const [filterBuyZoneOnly, setFilterBuyZoneOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"distance" | "conviction" | "symbol">("distance");

  const searchParams = useSearchParams();
  const urlCompanyId = searchParams?.get("company_id") || searchParams?.get("add");

  useEffect(() => {
    if (urlCompanyId && !isNaN(Number(urlCompanyId))) {
      fetchCompanyById(Number(urlCompanyId))
        .then((comp) => {
          if (comp) {
            const primarySec = comp.securities?.find((s) => s.is_primary) || comp.securities?.[0];
            setSelectedStock({
              id: comp.id,
              name: comp.name,
              isin: comp.isin,
              primary_symbol: primarySec?.symbol || comp.name,
              current_price: comp.current_price,
              is_financial_sector: comp.is_financial_sector,
              status: comp.status,
              exchange_listings: comp.securities?.map((s) => s.exchange_code) || [],
              securities: comp.securities || [],
            });
            setIsAddItemOpen(true);
          }
        })
        .catch(() => {});
    }
  }, [urlCompanyId]);

  // Load Watchlists
  const loadWatchlists = async (keepActiveId?: number) => {
    try {
      setLoading(true);
      setError(null);
      let lists = await fetchWatchlists();

      // If no watchlists exist, create a default one
      if (lists.length === 0) {
        const defaultWl = await createWatchlist({
          name: "High Conviction Ideas",
          description: "Core high-conviction compounders & target buy levels",
          color: "#00d992",
        });
        lists = [defaultWl];
      }

      setWatchlists(lists);
      if (keepActiveId && lists.some((l) => l.id === keepActiveId)) {
        setActiveWatchlistId(keepActiveId);
      } else {
        setActiveWatchlistId(lists[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load watchlists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlists();
  }, []);

  // Stock search debouncing
  useEffect(() => {
    if (!itemSearchQuery.trim()) {
      setItemSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const res = await fetchCompanySearch(itemSearchQuery);
          setItemSearchResults(res.items.slice(0, 5));
        } catch {
          // Ignore
        }
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [itemSearchQuery]);

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId);

  // Handle Create Watchlist
  const handleCreateWatchlist = async () => {
    if (!newWlName.trim()) return;
    try {
      const created = await createWatchlist({
        name: newWlName.trim(),
        description: newWlDesc.trim(),
        color: newWlColor,
      });
      setWatchlists((prev) => [...prev, created]);
      setActiveWatchlistId(created.id);
      setIsNewWatchlistOpen(false);
      setNewWlName("");
      setNewWlDesc("");
    } catch (err: any) {
      alert(`Failed to create: ${err.message}`);
    }
  };

  // Handle Delete Watchlist
  const handleDeleteWatchlist = async (id: number) => {
    if (!confirm("Are you sure you want to delete this watchlist?")) return;
    try {
      await deleteWatchlist(id);
      const remaining = watchlists.filter((w) => w.id !== id);
      setWatchlists(remaining);
      if (remaining.length > 0) {
        setActiveWatchlistId(remaining[0].id);
      } else {
        loadWatchlists();
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Handle Add Item
  const handleAddItem = async () => {
    if (!activeWatchlistId || !selectedStock) return;
    try {
      await addWatchlistItem(activeWatchlistId, {
        company_id: selectedStock.id,
        target_entry_price: entryTarget ? parseFloat(entryTarget) : undefined,
        target_exit_price: exitTarget ? parseFloat(exitTarget) : undefined,
        conviction,
        thesis_summary: thesisSummary.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setIsAddItemOpen(false);
      setSelectedStock(null);
      setItemSearchQuery("");
      setEntryTarget("");
      setExitTarget("");
      setThesisSummary("");
      setNotes("");
      loadWatchlists(activeWatchlistId);
    } catch (err: any) {
      alert(`Failed to add: ${err.message}`);
    }
  };

  // Handle Edit Item
  const handleSaveEditItem = async () => {
    if (!activeWatchlistId || !editingItem) return;
    try {
      await updateWatchlistItem(activeWatchlistId, editingItem.id, {
        target_entry_price: editEntry ? parseFloat(editEntry) : undefined,
        target_exit_price: editExit ? parseFloat(editExit) : undefined,
        conviction: editConviction,
        notes: editNotes,
      });
      setEditingItem(null);
      loadWatchlists(activeWatchlistId);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  // Handle Remove Item
  const handleRemoveItem = async (itemId: number) => {
    if (!activeWatchlistId) return;
    try {
      await removeWatchlistItem(activeWatchlistId, itemId);
      loadWatchlists(activeWatchlistId);
    } catch (err: any) {
      alert(`Remove failed: ${err.message}`);
    }
  };

  // Filter & Sort Items
  const displayedItems = (activeWatchlist?.items || [])
    .filter((it) => {
      if (filterBuyZoneOnly) {
        return typeof it.distance_to_entry_pct === "number" && it.distance_to_entry_pct <= 0;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "distance") {
        const da = a.distance_to_entry_pct ?? 999;
        const db = b.distance_to_entry_pct ?? 999;
        return da - db;
      }
      if (sortBy === "conviction") {
        return b.conviction - a.conviction;
      }
      return a.symbol.localeCompare(b.symbol);
    });

  return (
    <div className="min-h-screen bg-canvas text-ink p-6 lg:p-8 space-y-8 max-w-[1440px] mx-auto">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <div className="eyebrow-mono text-primary flex items-center gap-2 mb-1">
            <Bookmark className="w-4 h-4" />
            <span>PHASE 13 • PORTFOLIO WORKFLOWS</span>
          </div>
          <h1 className="text-3xl font-normal tracking-tight text-ink-strong">
            Watchlists & Target Allocation
          </h1>
          <p className="text-sm text-body mt-1">
            Monitor target buy/sell trigger prices, calculate distance to entry levels, and track
            conviction ratings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewWatchlistOpen(true)}
            className="px-3.5 py-2 bg-canvas-soft border border-hairline text-ink hover:border-mute rounded-sm text-xs font-mono font-medium flex items-center gap-2 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-mute" />
            New Watchlist
          </button>
          <button
            onClick={() => setIsAddItemOpen(true)}
            disabled={!activeWatchlistId}
            className="px-4 py-2 bg-primary text-on-primary rounded-sm text-xs font-mono font-semibold hover:bg-primary-soft transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Stock
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-mute space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="font-mono text-xs">Loading watchlists & live target levels...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-rose-950/30 border border-rose-800 text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ─── Left Column: Watchlist Roster ─────────────────────────────── */}
          <div className="lg:col-span-3 space-y-3">
            <div className="eyebrow-mono text-mute text-[11px] px-1">YOUR WATCHLISTS</div>
            <div className="space-y-1.5">
              {watchlists.map((wl) => {
                const isActive = wl.id === activeWatchlistId;
                return (
                  <div
                    key={wl.id}
                    onClick={() => setActiveWatchlistId(wl.id)}
                    className={`p-3 rounded-md border cursor-pointer transition-all flex items-center justify-between group ${
                      isActive
                        ? "bg-canvas-card border-primary text-ink-strong"
                        : "bg-canvas-soft border-hairline text-body hover:border-mute"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: wl.color || "#00d992" }}
                      />
                      <div className="truncate">
                        <div className="text-xs font-medium font-mono truncate">{wl.name}</div>
                        <div className="text-[10px] text-mute font-mono">
                          {wl.items_count} {wl.items_count === 1 ? "stock" : "stocks"}
                        </div>
                      </div>
                    </div>

                    {watchlists.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWatchlist(wl.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-mute hover:text-rose-400 transition-opacity"
                        title="Delete Watchlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Right Column: Active Watchlist Items ──────────────────────── */}
          <div className="lg:col-span-9 space-y-4">
            {activeWatchlist && (
              <>
                {/* Watchlist Meta & Controls Bar */}
                <div className="bg-canvas-card border border-hairline rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-normal text-ink-strong">{activeWatchlist.name}</h2>
                    {activeWatchlist.description && (
                      <p className="text-xs text-mute mt-0.5">{activeWatchlist.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    {/* In Buy Zone Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer bg-canvas-soft border border-hairline rounded px-2.5 py-1.5 hover:border-mute">
                      <input
                        type="checkbox"
                        checked={filterBuyZoneOnly}
                        onChange={(e) => setFilterBuyZoneOnly(e.target.checked)}
                        className="accent-primary"
                      />
                      <span className="text-ink">🎯 In Buy Zone Only</span>
                    </label>

                    {/* Sort Dropdown */}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-canvas-soft border border-hairline rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-primary"
                    >
                      <option value="distance">Sort: Proximity to Entry</option>
                      <option value="conviction">Sort: Conviction (High-Low)</option>
                      <option value="symbol">Sort: Symbol (A-Z)</option>
                    </select>
                  </div>
                </div>

                {/* Items Table / Empty State */}
                {displayedItems.length === 0 ? (
                  <div className="bg-canvas-card border border-hairline rounded-md p-12 text-center space-y-4">
                    <Target className="w-10 h-10 text-mute mx-auto stroke-[1.5]" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium text-ink">
                        {filterBuyZoneOnly ? "No stocks currently in buy zone" : "This watchlist is empty"}
                      </h3>
                      <p className="text-xs text-mute max-w-sm mx-auto">
                        {filterBuyZoneOnly
                          ? "None of the stocks are trading at or below their target entry price."
                          : "Add benchmark equities or search Indian equities to track target entry prices and convictions."}
                      </p>
                    </div>
                    {!filterBuyZoneOnly && (
                      <button
                        onClick={() => setIsAddItemOpen(true)}
                        className="px-4 py-2 bg-primary text-on-primary rounded-sm text-xs font-mono font-medium hover:bg-primary-soft transition-colors"
                      >
                        Add Your First Stock
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-canvas-card border border-hairline rounded-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono text-left">
                        <thead>
                          <tr className="border-b border-hairline bg-canvas-soft text-mute">
                            <th className="py-3 px-4">SECURITY</th>
                            <th className="py-3 px-4 text-right">MARKET PRICE</th>
                            <th className="py-3 px-4 text-right">TARGET ENTRY</th>
                            <th className="py-3 px-4 text-right">DISTANCE TO ENTRY</th>
                            <th className="py-3 px-4 text-center">CONVICTION</th>
                            <th className="py-3 px-4 text-right">TARGET EXIT</th>
                            <th className="py-3 px-4 text-right">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {displayedItems.map((item) => {
                            const isAtOrBelowEntry =
                              typeof item.distance_to_entry_pct === "number" && item.distance_to_entry_pct <= 0;
                            return (
                              <tr key={item.id} className="hover:bg-canvas-soft/40 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <Link
                                      href={`/companies/${item.company_id}`}
                                      className="font-bold text-ink-strong hover:text-primary transition-colors flex items-center gap-1"
                                    >
                                      {item.symbol}
                                      <ArrowUpRight className="w-3 h-3 text-mute" />
                                    </Link>
                                    {item.is_financial_sector && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950/40 text-amber-400 border border-amber-900/40">
                                        BANK
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-mute truncate max-w-[180px]">
                                    {item.company_name}
                                  </div>
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="font-bold text-ink">
                                    {item.current_price ? `₹${item.current_price.toFixed(2)}` : "—"}
                                  </div>
                                  {typeof item.price_change_pct === "number" && (
                                    <div
                                      className={`text-[10px] ${
                                        item.price_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                                      }`}
                                    >
                                      {item.price_change_pct >= 0 ? "+" : ""}
                                      {item.price_change_pct.toFixed(2)}%
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right font-medium">
                                  {item.target_entry_price ? (
                                    <span className="text-primary font-bold">
                                      ₹{item.target_entry_price.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-mute">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  {typeof item.distance_to_entry_pct === "number" ? (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                        isAtOrBelowEntry
                                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-600/60"
                                          : "text-mute"
                                      }`}
                                    >
                                      {isAtOrBelowEntry ? "🎯 IN BUY ZONE (" : "+"}
                                      {item.distance_to_entry_pct.toFixed(1)}%
                                      {isAtOrBelowEntry ? ")" : ""}
                                    </span>
                                  ) : (
                                    <span className="text-mute">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-0.5 text-primary">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                      <Star
                                        key={idx}
                                        className={`w-3.5 h-3.5 ${
                                          idx < item.conviction
                                            ? "fill-primary text-primary"
                                            : "text-hairline"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </td>

                                <td className="py-3 px-4 text-right">
                                  {item.target_exit_price ? (
                                    <span className="text-ink">₹{item.target_exit_price.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-mute">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Link
                                      href={`/valuation`}
                                      className="p-1 text-mute hover:text-primary transition-colors"
                                      title="Open Valuation"
                                    >
                                      <SlidersHorizontal className="w-3.5 h-3.5" />
                                    </Link>
                                    <button
                                      onClick={() => {
                                        setEditingItem(item);
                                        setEditEntry(item.target_entry_price?.toString() || "");
                                        setEditExit(item.target_exit_price?.toString() || "");
                                        setEditConviction(item.conviction);
                                        setEditNotes(item.notes || "");
                                      }}
                                      className="p-1 text-mute hover:text-ink transition-colors"
                                      title="Edit Targets"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveItem(item.id)}
                                      className="p-1 text-mute hover:text-rose-400 transition-colors"
                                      title="Remove from Watchlist"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal: New Watchlist ─────────────────────────────────────────── */}
      {isNewWatchlistOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-canvas-card border border-hairline rounded-md p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-normal text-ink-strong">Create New Watchlist</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-mute font-mono block mb-1">WATCHLIST NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Turnaround Candidates"
                  value={newWlName}
                  onChange={(e) => setNewWlName(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-mute font-mono block mb-1">DESCRIPTION</label>
                <input
                  type="text"
                  placeholder="Thesis or mandate..."
                  value={newWlDesc}
                  onChange={(e) => setNewWlDesc(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-mute font-mono block mb-1">COLOR TAG</label>
                <div className="flex gap-2">
                  {["#00d992", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewWlColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        newWlColor === c ? "border-ink scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
              <button
                onClick={() => setIsNewWatchlistOpen(false)}
                className="px-3 py-1.5 text-xs font-mono text-mute hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWatchlist}
                disabled={!newWlName.trim()}
                className="px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-mono font-semibold hover:bg-primary-soft transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Add Stock to Watchlist ─────────────────────────────────── */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="apple-card p-6 max-w-lg w-full space-y-4 shadow-overlay">
            <h3 className="text-base font-normal text-ink-strong">Add Stock to Watchlist</h3>

            {/* Company Search */}
            <div className="space-y-1">
              <label htmlFor="watchlist-search-stock" className="text-[11px] font-mono text-mute">SEARCH STOCK</label>
              <div className="relative">
                <input
                  id="watchlist-search-stock"
                  type="text"
                  placeholder="Search by symbol or name (e.g. RELIANCE, TCS)..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded-lg px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
                />
                {itemSearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-canvas-card border border-hairline rounded shadow-xl z-50 overflow-hidden divide-y divide-hairline">
                    {itemSearchResults.map((stock) => (
                      <div
                        key={stock.id}
                        onClick={() => {
                          setSelectedStock(stock);
                          setItemSearchQuery(`${stock.primary_symbol || stock.name} - ${stock.name}`);
                          setItemSearchResults([]);
                        }}
                        className="p-2.5 hover:bg-canvas-soft cursor-pointer text-xs flex justify-between items-center"
                      >
                        <span className="font-mono font-semibold text-primary">{stock.primary_symbol || stock.name}</span>
                        <span className="text-mute truncate ml-2">{stock.name}</span>
                        {stock.current_price != null && (
                          <span className="font-mono text-ink ml-2">₹{Number(stock.current_price).toFixed(2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedStock && (
              <div className="p-3 bg-canvas-soft rounded border border-hairline text-xs font-mono flex justify-between">
                <div>
                  <span className="text-primary font-bold">{selectedStock.primary_symbol || selectedStock.name}</span>
                  <span className="text-mute ml-2">{selectedStock.name}</span>
                </div>
                {selectedStock.current_price != null && (
                  <span className="text-ink">CMP: ₹{Number(selectedStock.current_price).toFixed(2)}</span>
                )}
              </div>
            )}

            {/* Target Prices & Conviction */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label htmlFor="watchlist-target-entry" className="text-mute block mb-1">TARGET ENTRY (₹)</label>
                <input
                  id="watchlist-target-entry"
                  type="number"
                  placeholder="e.g. 1250"
                  value={entryTarget}
                  onChange={(e) => setEntryTarget(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded-lg px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="watchlist-target-exit" className="text-mute block mb-1">TARGET EXIT (₹)</label>
                <input
                  id="watchlist-target-exit"
                  type="number"
                  placeholder="e.g. 1800"
                  value={exitTarget}
                  onChange={(e) => setExitTarget(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded-lg px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="text-xs font-mono space-y-1">
              <label className="text-mute block">CONVICTION RATING (1-5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setConviction(lvl)}
                    className={`flex-1 py-1.5 rounded border transition-colors ${
                      conviction >= lvl
                        ? "bg-primary/20 text-primary border-primary font-bold"
                        : "bg-canvas-soft text-mute border-hairline"
                    }`}
                  >
                    ★ {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs space-y-1">
              <label className="text-[11px] font-mono text-mute block">THESIS / ACCUMULATION NOTE</label>
              <input
                type="text"
                placeholder="Key trigger or reason to accumulate..."
                value={thesisSummary}
                onChange={(e) => setThesisSummary(e.target.value)}
                className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink text-xs focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
              <button
                onClick={() => setIsAddItemOpen(false)}
                className="px-3 py-1.5 text-xs font-mono text-mute hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={!selectedStock}
                className="px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-mono font-semibold hover:bg-primary-soft transition-colors disabled:opacity-50"
              >
                Add Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Edit Item ─────────────────────────────────────────────── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-canvas-card border border-hairline rounded-md p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-normal text-ink-strong">
              Edit Targets for {editingItem.symbol}
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="text-mute block mb-1">TARGET ENTRY (₹)</label>
                <input
                  type="number"
                  value={editEntry}
                  onChange={(e) => setEditEntry(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-mute block mb-1">TARGET EXIT (₹)</label>
                <input
                  type="number"
                  value={editExit}
                  onChange={(e) => setEditExit(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="text-xs font-mono space-y-1">
              <label className="text-mute block">CONVICTION RATING</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setEditConviction(lvl)}
                    className={`flex-1 py-1.5 rounded border transition-colors ${
                      editConviction >= lvl
                        ? "bg-primary/20 text-primary border-primary font-bold"
                        : "bg-canvas-soft text-mute border-hairline"
                    }`}
                  >
                    ★ {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs space-y-1">
              <label className="text-[11px] font-mono text-mute block">NOTES</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink text-xs focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
              <button
                onClick={() => setEditingItem(null)}
                className="px-3 py-1.5 text-xs font-mono text-mute hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditItem}
                className="px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-mono font-semibold hover:bg-primary-soft transition-colors"
              >
                Save Targets
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
