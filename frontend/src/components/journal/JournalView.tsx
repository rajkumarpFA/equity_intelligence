"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Star,
  Search,
  ExternalLink,
  Target,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Tag,
  Filter,
} from "lucide-react";
import {
  fetchJournalNotes,
  createJournalNote,
  updateJournalNote,
  deleteJournalNote,
  fetchCompanySearch,
  fetchCompanyById,
} from "@/lib/api-client";
import type { InvestmentNote, CatalystItem, RiskItem } from "@/types/workflow";
import type { CompanySearchItem } from "@/types/company";

const CATEGORIES = [
  { key: "ALL", label: "All Categories" },
  { key: "THESIS", label: "Initial Thesis" },
  { key: "EARNINGS", label: "Earnings Review" },
  { key: "RISK", label: "Risk & Moat Update" },
  { key: "VALUATION", label: "Valuation Note" },
  { key: "POST_MORTEM", label: "Post-Mortem / Exit" },
];

export function JournalView() {
  const [notes, setNotes] = useState<InvestmentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [minConviction, setMinConviction] = useState<number | null>(null);
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Create Modal
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [noteCompanyQuery, setNoteCompanyQuery] = useState("");
  const [noteCompanyResults, setNoteCompanyResults] = useState<CompanySearchItem[]>([]);
  const [isSearchingCompany, startSearchTransition] = useTransition();
  const [selectedStock, setSelectedStock] = useState<CompanySearchItem | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("THESIS");
  const [convictionScore, setConvictionScore] = useState(4);
  const [targetPrice, setTargetPrice] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [content, setContent] = useState("");

  // Catalysts builder
  const [catalysts, setCatalysts] = useState<CatalystItem[]>([]);
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatDate, setNewCatDate] = useState("");
  const [newCatImpact, setNewCatImpact] = useState<"HIGH" | "MEDIUM" | "LOW">("HIGH");

  // Key Risks builder
  const [keyRisks, setKeyRisks] = useState<RiskItem[]>([]);
  const [newRiskTitle, setNewRiskTitle] = useState("");
  const [newRiskSeverity, setNewRiskSeverity] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");

  const searchParams = useSearchParams();
  const urlCompanyId = searchParams?.get("company_id");

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
            setIsNewNoteOpen(true);
          }
        })
        .catch(() => {});
    }
  }, [urlCompanyId]);

  // Load Notes
  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (activeCategory !== "ALL") params.category = activeCategory;
      if (minConviction) params.min_conviction = minConviction;

      const data = await fetchJournalNotes(params);
      setNotes(data);
    } catch (err: any) {
      setError(err.message || "Failed to load journal notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [activeCategory, minConviction]);

  // Company search debouncing in modal
  useEffect(() => {
    if (!noteCompanyQuery.trim()) {
      setNoteCompanyResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const res = await fetchCompanySearch(noteCompanyQuery);
          setNoteCompanyResults(res.items.slice(0, 5));
        } catch {
          // Ignore
        }
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [noteCompanyQuery]);

  // Add Catalyst
  const handleAddCatalyst = () => {
    if (!newCatTitle.trim()) return;
    setCatalysts([
      ...catalysts,
      {
        title: newCatTitle.trim(),
        target_date: newCatDate.trim() || undefined,
        status: "PENDING",
        impact: newCatImpact,
      },
    ]);
    setNewCatTitle("");
    setNewCatDate("");
  };

  // Add Risk
  const handleAddRisk = () => {
    if (!newRiskTitle.trim()) return;
    setKeyRisks([
      ...keyRisks,
      {
        title: newRiskTitle.trim(),
        severity: newRiskSeverity,
      },
    ]);
    setNewRiskTitle("");
  };

  // Submit New Note
  const handleCreateNote = async () => {
    if (!selectedStock || !title.trim() || !content.trim()) return;
    try {
      await createJournalNote({
        company_id: selectedStock.id,
        title: title.trim(),
        category,
        conviction_score: convictionScore,
        content: content.trim(),
        catalysts,
        key_risks: keyRisks,
        target_price: targetPrice ? parseFloat(targetPrice) : undefined,
        review_date: reviewDate ? new Date(reviewDate).toISOString() : undefined,
      });
      setIsNewNoteOpen(false);
      setSelectedStock(null);
      setNoteCompanyQuery("");
      setTitle("");
      setContent("");
      setTargetPrice("");
      setReviewDate("");
      setCatalysts([]);
      setKeyRisks([]);
      loadNotes();
    } catch (err: any) {
      alert(`Failed to save note: ${err.message}`);
    }
  };

  // Delete Note
  const handleDeleteNote = async (id: number) => {
    if (!confirm("Are you sure you want to delete this journal entry?")) return;
    try {
      await deleteJournalNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Filter by search string
  const filteredNotes = notes.filter((n) => {
    if (!filterSearch.trim()) return true;
    const term = filterSearch.toLowerCase();
    return (
      n.symbol.toLowerCase().includes(term) ||
      n.company_name.toLowerCase().includes(term) ||
      n.title.toLowerCase().includes(term) ||
      n.content.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-canvas text-ink p-6 lg:p-8 space-y-8 max-w-[1440px] mx-auto">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <div className="eyebrow-mono text-primary flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4" />
            <span>PHASE 13 • INVESTMENT JOURNAL</span>
          </div>
          <h1 className="text-3xl font-normal tracking-tight text-ink-strong">
            Investment Thesis Journal
          </h1>
          <p className="text-sm text-body mt-1">
            Document buy/sell rationale, catalyst timelines, moat risks, and post-mortems for disciplined compounding.
          </p>
        </div>

        <button
          onClick={() => setIsNewNoteOpen(true)}
          className="px-4 py-2 bg-primary text-on-primary rounded-sm text-xs font-mono font-semibold hover:bg-primary-soft transition-colors flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Log Investment Thesis
        </button>
      </div>

      {/* ─── Filter Pills Bar (Apple Segmented Control) ────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 apple-card p-3">
        {/* Category Pills */}
        <div className="inline-flex bg-slate-200/50 dark:bg-white/10 p-1 rounded-pill gap-1 overflow-x-auto text-xs border border-hairline">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1 rounded-pill transition-all whitespace-nowrap text-xs font-medium ${
                activeCategory === cat.key
                  ? "bg-[var(--surface)] text-[var(--text-1)] shadow-sm font-semibold"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Conviction Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search thesis, symbols..."
              aria-label="Search investment journal notes and symbols"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full bg-canvas-soft border border-hairline rounded-pill px-3.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
            />
          </div>

          <select
            value={minConviction || ""}
            onChange={(e) => setMinConviction(e.target.value ? parseInt(e.target.value) : null)}
            className="bg-canvas-soft border border-hairline rounded px-2.5 py-1.5 text-xs text-ink font-mono focus:border-primary focus:outline-none"
          >
            <option value="">All Conviction</option>
            <option value="5">★★★★★ (5 Stars)</option>
            <option value="4">★★★★☆ (4+ Stars)</option>
            <option value="3">★★★☆☆ (3+ Stars)</option>
          </select>
        </div>
      </div>

      {/* ─── Notes Timeline Stream ─────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center text-mute space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="font-mono text-xs">Loading thesis entries & catalyst timelines...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-rose-950/30 border border-rose-800 text-rose-300">
          {error}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-canvas-card border border-hairline rounded-md p-16 text-center space-y-4">
          <BookOpen className="w-12 h-12 text-mute mx-auto stroke-[1.5]" />
          <div className="space-y-1">
            <h3 className="text-base font-medium text-ink">No investment notes found</h3>
            <p className="text-xs text-mute max-w-sm mx-auto">
              Document your initial thesis, quarterly earnings print observations, or valuation updates
              to build an institutional track record.
            </p>
          </div>
          <button
            onClick={() => setIsNewNoteOpen(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-sm text-xs font-mono font-medium hover:bg-primary-soft transition-colors"
          >
            Log Your First Thesis Note
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-canvas-card border border-hairline rounded-md p-6 space-y-5 hover:border-mute/80 transition-all"
            >
              {/* Note Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/30">
                      {note.category}
                    </span>
                    <Link
                      href={`/companies/${note.company_id}`}
                      className="font-mono font-bold text-sm text-ink-strong hover:text-primary transition-colors flex items-center gap-1"
                    >
                      {note.symbol}
                      <ExternalLink className="w-3 h-3 text-mute" />
                    </Link>
                    <span className="text-xs text-mute">• {note.company_name}</span>
                  </div>
                  <h3 className="text-base font-normal text-ink-strong pt-0.5">{note.title}</h3>
                </div>

                <div className="flex items-center gap-4">
                  {/* Conviction Stars */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`w-3.5 h-3.5 ${
                          idx < note.conviction_score
                            ? "fill-primary text-primary"
                            : "text-hairline"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1 text-mute hover:text-rose-400 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Meta Ribbon: Target & Review Date */}
              {(note.target_price || note.review_date) && (
                <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-mute bg-canvas-soft p-3 rounded border border-hairline">
                  {note.target_price && (
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <span>Target Price:</span>
                      <span className="text-ink font-bold">₹{note.target_price.toFixed(2)}</span>
                    </div>
                  )}
                  {note.review_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span>Scheduled Review:</span>
                      <span className="text-ink">
                        {new Date(note.review_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto text-[11px]">
                    <Clock className="w-3 h-3 text-mute" />
                    <span>Logged {new Date(note.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              {/* Catalysts & Key Risks Badges */}
              {(note.catalysts.length > 0 || note.key_risks.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Catalysts */}
                  {note.catalysts.length > 0 && (
                    <div className="p-3 bg-canvas-soft rounded border border-hairline space-y-2">
                      <div className="text-[10px] text-mute flex items-center gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 text-primary" />
                        CATALYSTS & TRIGGERS
                      </div>
                      <div className="space-y-1.5">
                        {note.catalysts.map((cat, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="text-ink">{cat.title}</span>
                            <div className="flex items-center gap-2">
                              {cat.target_date && <span className="text-mute">{cat.target_date}</span>}
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary/20 text-primary">
                                {cat.impact}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Risks */}
                  {note.key_risks.length > 0 && (
                    <div className="p-3 bg-canvas-soft rounded border border-hairline space-y-2">
                      <div className="text-[10px] text-mute flex items-center gap-1 font-semibold">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        KEY THESIS RISKS
                      </div>
                      <div className="space-y-1.5">
                        {note.key_risks.map((r, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="text-ink">{r.title}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950/40 text-amber-400 border border-amber-900/40">
                              {r.severity} RISK
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Note Markdown Content */}
              <div className="text-sm text-body leading-relaxed whitespace-pre-wrap font-sans bg-canvas p-4 rounded border border-hairline">
                {note.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Modal: New Journal Note ───────────────────────────────────────── */}
      {isNewNoteOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-canvas-card border border-hairline rounded-md p-6 max-w-2xl w-full space-y-4 my-8">
            <h3 className="text-base font-normal text-ink-strong">Log Investment Thesis Entry</h3>

            {/* Company Search */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-mute">COMPANY</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search stock symbol (e.g. RELIANCE, TCS)..."
                  value={noteCompanyQuery}
                  onChange={(e) => setNoteCompanyQuery(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
                />
                {noteCompanyResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-canvas-card border border-hairline rounded shadow-xl z-50 overflow-hidden divide-y divide-hairline">
                    {noteCompanyResults.map((stock) => (
                      <div
                        key={stock.id}
                        onClick={() => {
                          setSelectedStock(stock);
                          setNoteCompanyQuery(`${stock.primary_symbol || stock.name} - ${stock.name}`);
                          setNoteCompanyResults([]);
                        }}
                        className="p-2.5 hover:bg-canvas-soft cursor-pointer text-xs flex justify-between items-center"
                      >
                        <span className="font-mono font-semibold text-primary">{stock.primary_symbol || stock.name}</span>
                        <span className="text-mute truncate ml-2">{stock.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div>
                <label className="text-mute block mb-1">CATEGORY</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink focus:border-primary focus:outline-none"
                >
                  <option value="THESIS">Initial Thesis</option>
                  <option value="EARNINGS">Earnings Review</option>
                  <option value="RISK">Risk Update</option>
                  <option value="VALUATION">Valuation Note</option>
                  <option value="POST_MORTEM">Post-Mortem</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-mute block mb-1">TITLE</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 FY27 Capex Inflection & Operating Leverage"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Target Price, Review Date, Conviction */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div>
                <label className="text-mute block mb-1">TARGET PRICE (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 1750"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-mute block mb-1">REVIEW DATE</label>
                <input
                  type="date"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                  className="w-full bg-canvas-soft border border-hairline rounded px-3 py-2 text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-mute block mb-1">CONVICTION (1-5)</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConvictionScore(lvl)}
                      className={`flex-1 py-2 rounded border text-xs font-bold ${
                        convictionScore >= lvl
                          ? "bg-primary/20 text-primary border-primary"
                          : "bg-canvas-soft text-mute border-hairline"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Catalysts Builder */}
            <div className="space-y-2 border-t border-hairline pt-3">
              <label className="text-[11px] font-mono text-mute block">CATALYSTS & TRIGGERS</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Catalyst description (e.g. FDA approval, plant launch)..."
                  value={newCatTitle}
                  onChange={(e) => setNewCatTitle(e.target.value)}
                  className="flex-1 bg-canvas-soft border border-hairline rounded px-3 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Target date (e.g. Q3 FY27)..."
                  value={newCatDate}
                  onChange={(e) => setNewCatDate(e.target.value)}
                  className="w-36 bg-canvas-soft border border-hairline rounded px-3 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCatalyst}
                  className="px-3 py-1.5 bg-canvas-soft border border-hairline text-ink hover:border-mute text-xs rounded font-mono"
                >
                  Add
                </button>
              </div>
              {catalysts.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {catalysts.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded bg-canvas-soft border border-hairline text-[11px] font-mono text-ink flex items-center gap-2"
                    >
                      <span>{c.title}</span>
                      <button
                        type="button"
                        onClick={() => setCatalysts(catalysts.filter((_, idx) => idx !== i))}
                        className="text-mute hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Markdown Content */}
            <div className="space-y-1 border-t border-hairline pt-3">
              <label className="text-[11px] font-mono text-mute block">THESIS & RATIONALE (MARKDOWN)</label>
              <textarea
                rows={6}
                placeholder="Explain the investment thesis, unit economics, capital allocation discipline, competitive moat, and potential exit triggers..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-canvas-soft border border-hairline rounded p-3 text-xs text-ink font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
              <button
                onClick={() => setIsNewNoteOpen(false)}
                className="px-3 py-1.5 text-xs font-mono text-mute hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNote}
                disabled={!selectedStock || !title.trim() || !content.trim()}
                className="px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-mono font-semibold hover:bg-primary-soft transition-colors disabled:opacity-50"
              >
                Save Thesis Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
