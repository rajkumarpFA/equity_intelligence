"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calculator,
  TrendingUp,
  Percent,
  Sliders,
  Bookmark,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Search,
  Building2,
  Trash2,
  Sparkles,
} from "lucide-react";
import {
  fetchCompanySearch,
  fetchValuationSummary,
  runDCFValuation,
  runReverseDCFValuation,
  runSensitivityMatrix,
  runDDMValuation,
  runGrahamValuation,
  saveValuationScenario,
  fetchSavedValuations,
  deleteSavedValuation,
} from "@/lib/api-client";
import type {
  ValuationSummaryResponse,
  DCFResult,
  DCFScenarioAssumptions,
  ReverseDCFResponse,
  SensitivityMatrixResponse,
  DDMResponse,
  GrahamResponse,
  SavedValuation,
} from "@/types/valuation";
import type { CompanySearchItem } from "@/types/company";

const BENCHMARK_SYMBOLS = [
  { symbol: "RELIANCE", name: "Reliance Industries", id: 1 },
  { symbol: "TCS", name: "Tata Consultancy Services", id: 2 },
  { symbol: "HDFCBANK", name: "HDFC Bank", id: 3 },
  { symbol: "TATAMOTORS", name: "Tata Motors", id: 4 },
  { symbol: "SUZLON", name: "Suzlon Energy", id: 5 },
  { symbol: "TANLA", name: "Tanla Platforms", id: 6 },
  { symbol: "TATATECH", name: "Tata Technologies", id: 7 },
];

export function ValuationWorkbench() {
  const searchParams = useSearchParams();
  const urlCompanyId = searchParams?.get("company_id");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(
    urlCompanyId && !isNaN(Number(urlCompanyId)) ? Number(urlCompanyId) : 1
  );
  const [activeTab, setActiveTab] = useState<
    "summary" | "dcf" | "reverse_dcf" | "multiples" | "ddm" | "graham" | "saved"
  >("summary");

  // Summary state
  const [summary, setSummary] = useState<ValuationSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchItem[]>([]);
  const [isSearching, startSearchTransition] = useTransition();

  // DCF Model Interactive State
  const [dcfAssumptions, setDcfAssumptions] = useState<DCFScenarioAssumptions>({
    forecast_years: 5,
    revenue_growth_rates: [0.15, 0.14, 0.13, 0.12, 0.10],
    operating_margins: [0.20, 0.20, 0.20, 0.20, 0.20],
    tax_rate: 0.25,
    reinvestment_rates: [0.30, 0.30, 0.30, 0.30, 0.30],
    wacc: 0.12,
    terminal_growth_rate: 0.05,
    terminal_method: "GORDON_GROWTH",
    exit_multiple: 15.0,
  });
  const [customDCFResult, setCustomDCFResult] = useState<DCFResult | null>(null);
  const [isDCFRunning, setIsDCFRunning] = useState(false);

  // Reverse DCF & Sensitivity state
  const [reverseDCFResult, setReverseDCFResult] = useState<ReverseDCFResponse | null>(null);
  const [sensitivityResult, setSensitivityResult] = useState<SensitivityMatrixResponse | null>(null);

  // DDM interactive state
  const [costOfEquity, setCostOfEquity] = useState(0.13);
  const [ddmGrowthRate, setDdmGrowthRate] = useState(0.06);
  const [customDDM, setCustomDDM] = useState<DDMResponse | null>(null);

  // Graham interactive state
  const [grahamGrowth, setGrahamGrowth] = useState(0.10);
  const [bondYield, setBondYield] = useState(7.10);
  const [customGraham, setCustomGraham] = useState<GrahamResponse | null>(null);

  // Saved scenarios state
  const [savedScenarios, setSavedScenarios] = useState<SavedValuation[]>([]);
  const [saveScenarioName, setSaveScenarioName] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load summary on company selection
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const sum = await fetchValuationSummary(selectedCompanyId);
        if (isMounted) {
          setSummary(sum);
          setCustomDCFResult(sum.dcf || null);
          setReverseDCFResult(sum.reverse_dcf || null);
          setCustomDDM(sum.ddm || null);
          setCustomGraham(sum.graham || null);

          // Also load sensitivity matrix
          try {
            const sens = await runSensitivityMatrix({
              company_id: selectedCompanyId,
              current_price: sum.current_price,
            });
            if (isMounted) setSensitivityResult(sens);
          } catch {
            // Ignore if sensitivity fails
          }

          // Load saved scenarios
          try {
            const saved = await fetchSavedValuations(selectedCompanyId);
            if (isMounted) setSavedScenarios(saved);
          } catch {
            // Ignore
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load valuation data for this company");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedCompanyId]);

  // Search debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const res = await fetchCompanySearch(searchQuery);
          setSearchResults(res.items.slice(0, 6));
        } catch {
          // Ignore
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Recalculate DCF
  const handleRecalculateDCF = async () => {
    if (!summary) return;
    setIsDCFRunning(true);
    try {
      const res = await runDCFValuation(
        summary.company_id,
        dcfAssumptions,
        summary.current_price
      );
      setCustomDCFResult(res);
    } catch (err: any) {
      alert(`DCF failed: ${err.message}`);
    } finally {
      setIsDCFRunning(false);
    }
  };

  // Recalculate DDM
  const handleRecalculateDDM = async () => {
    if (!summary) return;
    try {
      const res = await runDDMValuation({
        company_id: summary.company_id,
        cost_of_equity: costOfEquity,
        dividend_growth_rate: ddmGrowthRate,
        current_price: summary.current_price,
      });
      setCustomDDM(res);
    } catch (err: any) {
      alert(`DDM failed: ${err.message}`);
    }
  };

  // Recalculate Graham
  const handleRecalculateGraham = async () => {
    if (!summary) return;
    try {
      const res = await runGrahamValuation({
        company_id: summary.company_id,
        expected_growth_rate: grahamGrowth,
        benchmark_yield_pct: bondYield,
        current_price: summary.current_price,
      });
      setCustomGraham(res);
    } catch (err: any) {
      alert(`Graham failed: ${err.message}`);
    }
  };

  // Save scenario
  const handleSaveScenario = async () => {
    if (!summary || !saveScenarioName.trim()) return;
    setIsSaving(true);
    try {
      const targetVal =
        activeTab === "dcf" && customDCFResult
          ? customDCFResult.intrinsic_value_per_share
          : summary.consensus_fair_value;
      const mos =
        activeTab === "dcf" && customDCFResult
          ? customDCFResult.margin_of_safety_pct
          : summary.consensus_upside_pct;

      const created = await saveValuationScenario({
        company_id: summary.company_id,
        model_type: activeTab.toUpperCase(),
        scenario_name: saveScenarioName.trim().toUpperCase(),
        intrinsic_value: targetVal,
        current_price_at_run: summary.current_price,
        margin_of_safety_pct: mos,
        assumptions: { ...dcfAssumptions, costOfEquity, ddmGrowthRate, grahamGrowth },
        projections: customDCFResult ? customDCFResult.projections : [],
        notes: saveNotes,
      });
      setSavedScenarios((prev) => [created, ...prev]);
      setSaveSuccessMsg(`Scenario "${created.scenario_name}" saved successfully!`);
      setSaveScenarioName("");
      setSaveNotes("");
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScenario = async (id: number) => {
    try {
      await deleteSavedValuation(id);
      setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Scenario Presets
  const applyPreset = (preset: "BEAR" | "BASE" | "BULL") => {
    if (preset === "BEAR") {
      setDcfAssumptions({
        forecast_years: 5,
        revenue_growth_rates: [0.08, 0.08, 0.07, 0.06, 0.05],
        operating_margins: [0.15, 0.15, 0.15, 0.15, 0.15],
        tax_rate: 0.25,
        reinvestment_rates: [0.35, 0.35, 0.35, 0.35, 0.35],
        wacc: 0.14,
        terminal_growth_rate: 0.04,
        terminal_method: "GORDON_GROWTH",
        exit_multiple: 10.0,
      });
    } else if (preset === "BASE") {
      setDcfAssumptions({
        forecast_years: 5,
        revenue_growth_rates: [0.15, 0.14, 0.13, 0.12, 0.10],
        operating_margins: [0.20, 0.20, 0.20, 0.20, 0.20],
        tax_rate: 0.25,
        reinvestment_rates: [0.30, 0.30, 0.30, 0.30, 0.30],
        wacc: 0.12,
        terminal_growth_rate: 0.05,
        terminal_method: "GORDON_GROWTH",
        exit_multiple: 15.0,
      });
    } else {
      setDcfAssumptions({
        forecast_years: 5,
        revenue_growth_rates: [0.22, 0.20, 0.18, 0.16, 0.14],
        operating_margins: [0.25, 0.25, 0.25, 0.26, 0.26],
        tax_rate: 0.25,
        reinvestment_rates: [0.25, 0.25, 0.25, 0.25, 0.25],
        wacc: 0.105,
        terminal_growth_rate: 0.06,
        terminal_method: "GORDON_GROWTH",
        exit_multiple: 22.0,
      });
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink p-6 lg:p-8 space-y-8 max-w-[1440px] mx-auto">
      {/* ─── Header & Description ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <div className="eyebrow-mono text-primary flex items-center gap-2 mb-1">
            <Calculator className="w-4 h-4" />
            <span>PHASE 12 • QUANTITATIVE VALUATION WORKBENCH</span>
          </div>
          <h1 className="text-3xl font-normal tracking-tight text-ink-strong">
            Intrinsic Fair Value Models
          </h1>
          <p className="text-sm text-body mt-1">
            Multi-year DCF projections, reverse DCF growth solver, historical multiples bands,
            dividend discount models, and Graham valuation.
          </p>
        </div>

        {/* Company Quick Switcher & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <div className="flex items-center gap-2 bg-canvas-soft border border-hairline rounded-sm px-3 py-2 w-full sm:w-64 focus-within:border-primary transition-colors">
              <Search className="w-4 h-4 text-mute" />
              <input
                type="text"
                placeholder="Search symbol / company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-sm text-ink focus:outline-none w-full"
              />
              {isSearching && <RefreshCw className="w-3.5 h-3.5 text-mute animate-spin" />}
            </div>

            {/* Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-canvas-card border border-hairline rounded-md shadow-2xl z-50 overflow-hidden divide-y divide-hairline">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedCompanyId(item.id);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-canvas-soft transition-colors flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-semibold text-primary">{item.primary_symbol || item.name}</span>
                      <span className="text-mute ml-2">{item.name}</span>
                    </div>
                    {item.current_price && (
                      <span className="font-mono text-ink">₹{Number(item.current_price).toFixed(2)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Benchmark Quick Pills ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-mute mr-1 font-mono uppercase tracking-wider">Benchmarks:</span>
        {BENCHMARK_SYMBOLS.map((bench) => {
          const isSelected = selectedCompanyId === bench.id;
          return (
            <button
              key={bench.symbol}
              onClick={() => setSelectedCompanyId(bench.id)}
              className={`px-3 py-1.5 rounded-pill border font-mono transition-all ${
                isSelected
                  ? "bg-primary text-on-primary border-primary font-medium"
                  : "bg-canvas-soft text-body border-hairline hover:border-mute"
              }`}
            >
              {bench.symbol}
            </button>
          );
        })}
      </div>

      {/* ─── Active Company Hero Ribbon ────────────────────────────────────── */}
      {summary && (
        <div className="bg-canvas-card border border-hairline rounded-md p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold text-primary">{summary.symbol}</span>
              <span className="text-lg text-ink-strong">{summary.company_name}</span>
              {summary.is_financial_sector && (
                <span className="px-2 py-0.5 rounded-sm text-[11px] font-mono bg-amber-950/60 text-amber-400 border border-amber-800/60">
                  BANKING / LENDING MODEL
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-mute font-mono">
              <span>{summary.sector_name || "General Industrials"}</span>
              <span>•</span>
              <span>{summary.industry_name || "Diversified"}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="eyebrow-mono text-mute text-[11px]">CURRENT MARKET PRICE</div>
              <div className="font-mono text-2xl font-bold text-ink">
                ₹{summary.current_price.toFixed(2)}
              </div>
            </div>

            {summary.consensus_fair_value && (
              <div className="text-right border-l border-hairline pl-6">
                <div className="eyebrow-mono text-mute text-[11px]">CONSENSUS FAIR VALUE</div>
                <div className="font-mono text-2xl font-bold text-primary">
                  ₹{summary.consensus_fair_value.toFixed(2)}
                </div>
                <div
                  className={`text-xs font-mono font-medium ${
                    (summary.consensus_upside_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {(summary.consensus_upside_pct || 0) >= 0 ? "+" : ""}
                  {summary.consensus_upside_pct?.toFixed(1)}% Margin of Safety
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex border-b border-hairline gap-2 overflow-x-auto text-sm">
        {[
          { key: "summary", label: "Consensus Summary" },
          { key: "dcf", label: "DCF & Scenarios" },
          { key: "reverse_dcf", label: "Reverse DCF & Sensitivity" },
          { key: "multiples", label: "Historical Multiples" },
          { key: "ddm", label: "Dividend Discount (DDM)" },
          { key: "graham", label: "Graham Formula" },
          { key: "saved", label: `Saved Scenarios (${savedScenarios.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 px-3 font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-mute hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24 text-center text-mute space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="font-mono text-xs">Computing quantitative valuation matrices...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-rose-950/30 border border-rose-800 text-rose-300 space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <span>Valuation Engine Error</span>
          </div>
          <p className="text-sm font-mono">{error}</p>
        </div>
      ) : !summary ? null : (
        <>
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: CONSENSUS SUMMARY                                            */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "summary" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* DCF Summary Card */}
                <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-3">
                  <div className="eyebrow-mono text-mute text-[11px] flex justify-between">
                    <span>DISCOUNTED CASH FLOW</span>
                    <span className="text-primary font-mono">FCFF 5Y</span>
                  </div>
                  {summary.dcf?.status === "SUCCESS" ? (
                    <div>
                      <div className="font-mono text-2xl font-bold text-ink">
                        ₹{summary.dcf.intrinsic_value_per_share.toFixed(2)}
                      </div>
                      <div
                        className={`text-xs font-mono font-medium mt-1 ${
                          summary.dcf.margin_of_safety_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {summary.dcf.margin_of_safety_pct >= 0 ? "+" : ""}
                        {summary.dcf.margin_of_safety_pct.toFixed(1)}% vs Market
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400/90 font-mono bg-amber-950/40 p-2 rounded border border-amber-900/50">
                      {summary.dcf?.reason || "Bypassed for this sector"}
                    </div>
                  )}
                  <button
                    onClick={() => setActiveTab("dcf")}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-mono pt-1"
                  >
                    Open DCF Builder <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Historical Multiples Card */}
                <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-3">
                  <div className="eyebrow-mono text-mute text-[11px] flex justify-between">
                    <span>HISTORICAL MULTIPLES</span>
                    <span className="text-primary font-mono">MEDIAN BANDS</span>
                  </div>
                  {summary.historical_multiples?.blended_target_price ? (
                    <div>
                      <div className="font-mono text-2xl font-bold text-ink">
                        ₹{summary.historical_multiples.blended_target_price.toFixed(2)}
                      </div>
                      <div
                        className={`text-xs font-mono font-medium mt-1 ${
                          (summary.historical_multiples.blended_margin_of_safety_pct || 0) >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {(summary.historical_multiples.blended_margin_of_safety_pct || 0) >= 0 ? "+" : ""}
                        {summary.historical_multiples.blended_margin_of_safety_pct?.toFixed(1)}% vs Market
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-mute font-mono">Multiples not available</div>
                  )}
                  <button
                    onClick={() => setActiveTab("multiples")}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-mono pt-1"
                  >
                    View Percentiles <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* DDM Card */}
                <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-3">
                  <div className="eyebrow-mono text-mute text-[11px] flex justify-between">
                    <span>DIVIDEND DISCOUNT</span>
                    <span className="text-primary font-mono">GORDON</span>
                  </div>
                  {summary.ddm?.is_applicable && summary.ddm.intrinsic_value ? (
                    <div>
                      <div className="font-mono text-2xl font-bold text-ink">
                        ₹{summary.ddm.intrinsic_value.toFixed(2)}
                      </div>
                      <div
                        className={`text-xs font-mono font-medium mt-1 ${
                          (summary.ddm.margin_of_safety_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {(summary.ddm.margin_of_safety_pct || 0) >= 0 ? "+" : ""}
                        {summary.ddm.margin_of_safety_pct?.toFixed(1)}% vs Market
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-mute font-mono bg-canvas-soft p-2 rounded">
                      {summary.ddm?.bypass_reason === "NO_DIVIDENDS_PAID"
                        ? "No dividend payouts recorded"
                        : "DDM not applicable"}
                    </div>
                  )}
                  <button
                    onClick={() => setActiveTab("ddm")}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-mono pt-1"
                  >
                    Configure DDM <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Graham Card */}
                <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-3">
                  <div className="eyebrow-mono text-mute text-[11px] flex justify-between">
                    <span>BENJAMIN GRAHAM</span>
                    <span className="text-primary font-mono">BOND YIELD ADJ</span>
                  </div>
                  {summary.graham?.is_applicable && summary.graham.graham_value ? (
                    <div>
                      <div className="font-mono text-2xl font-bold text-ink">
                        ₹{summary.graham.graham_value.toFixed(2)}
                      </div>
                      <div
                        className={`text-xs font-mono font-medium mt-1 ${
                          (summary.graham.margin_of_safety_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {(summary.graham.margin_of_safety_pct || 0) >= 0 ? "+" : ""}
                        {summary.graham.margin_of_safety_pct?.toFixed(1)}% vs Market
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-mute font-mono bg-canvas-soft p-2 rounded">
                      {summary.graham?.bypass_reason === "NEGATIVE_OR_ZERO_EPS"
                        ? "Requires positive normalized EPS"
                        : "Graham not applicable"}
                    </div>
                  )}
                  <button
                    onClick={() => setActiveTab("graham")}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-mono pt-1"
                  >
                    Graham Number <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Consensus Footprint & Method Weighting */}
              <div className="bg-canvas-card border border-hairline rounded-md p-6 space-y-4">
                <h3 className="text-base font-medium text-ink flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Consensus Intrinsic Value Footprint
                </h3>
                <p className="text-xs text-body leading-relaxed">
                  The consensus intrinsic value synthesizes independent quantitative valuation models
                  that are fundamentally applicable to {summary.company_name} given its capital structure
                  and accounting standard. Financial institutions are governed by DDM and Book Multiples,
                  while non-financial equities leverage FCFF DCF, EV/EBITDA, and Graham formulas.
                </p>

                <div className="p-4 bg-canvas-soft border border-hairline rounded-md flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-mute">
                      ACTIVE MODELS ({summary.applicable_models_count} of 4 models applicable)
                    </div>
                    <div className="text-sm text-ink font-medium">
                      Blended Target: <span className="font-mono text-primary font-bold">₹{summary.consensus_fair_value?.toFixed(2) || "N/A"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab("saved")}
                      className="px-4 py-2 bg-primary text-on-primary rounded-sm font-medium text-xs font-mono hover:bg-primary-soft transition-colors flex items-center gap-2"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      Save Valuation Scenario
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: DCF ENGINE & SCENARIO BUILDER                                */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "dcf" && (
            <div className="space-y-6">
              {summary.is_financial_sector ? (
                <div className="p-6 bg-amber-950/20 border border-amber-800/60 rounded-md text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <span>Financial Sector DCF Guard</span>
                  </div>
                  <p className="text-sm">
                    Commercial banks and lending institutions (such as {summary.company_name}) cannot
                    meaningfully use Free Cash Flow to Firm (FCFF) or EV/EBITDA because interest income
                    is operational revenue and balance-sheet deposits represent business funding rather
                    than conventional debt.
                  </p>
                  <p className="text-xs text-amber-300 font-mono pt-2">
                    → Please switch to the <strong>Dividend Discount (DDM)</strong> or{" "}
                    <strong>Historical Multiples (P/B)</strong> tabs for banking valuation.
                  </p>
                </div>
              ) : (
                <>
                  {/* Preset Buttons & Model Controls */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-canvas-card border border-hairline rounded-md p-4">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-mute mr-1">SCENARIO PRESETS:</span>
                      <button
                        onClick={() => applyPreset("BEAR")}
                        className="px-3 py-1 bg-canvas-soft border border-hairline hover:border-mute text-rose-300 rounded-sm"
                      >
                        Bear Case
                      </button>
                      <button
                        onClick={() => applyPreset("BASE")}
                        className="px-3 py-1 bg-canvas-soft border border-hairline hover:border-mute text-primary rounded-sm font-semibold"
                      >
                        Base Case
                      </button>
                      <button
                        onClick={() => applyPreset("BULL")}
                        className="px-3 py-1 bg-canvas-soft border border-hairline hover:border-mute text-emerald-300 rounded-sm"
                      >
                        Bull Case
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleRecalculateDCF}
                        disabled={isDCFRunning}
                        className="px-4 py-2 bg-primary text-on-primary rounded-sm font-mono text-xs font-semibold hover:bg-primary-soft transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isDCFRunning ? "animate-spin" : ""}`} />
                        Recalculate DCF
                      </button>
                    </div>
                  </div>

                  {/* Assumptions Sliders/Inputs Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* WACC */}
                    <div className="bg-canvas-card border border-hairline rounded-md p-4 space-y-2">
                      <div className="eyebrow-mono text-mute text-[11px] flex justify-between">
                        <span>WACC DISCOUNT RATE</span>
                        <span className="text-primary font-mono">{(dcfAssumptions.wacc * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.08"
                        max="0.20"
                        step="0.005"
                        value={dcfAssumptions.wacc}
                        onChange={(e) =>
                          setDcfAssumptions({ ...dcfAssumptions, wacc: parseFloat(e.target.value) })
                        }
                        className="w-full accent-primary bg-canvas-soft h-1.5 rounded cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-mute">
                        <span>8%</span>
                        <span>12%</span>
                        <span>20%</span>
                      </div>
                    </div>

                    {/* Terminal Growth */}
                    <div className="bg-canvas-card border border-hairline rounded-md p-4 space-y-2">
                      <div className="eyebrow-mono text-mute text-[11px] flex justify-between">
                        <span>TERMINAL GROWTH</span>
                        <span className="text-primary font-mono">
                          {(dcfAssumptions.terminal_growth_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.02"
                        max="0.08"
                        step="0.005"
                        value={dcfAssumptions.terminal_growth_rate}
                        onChange={(e) =>
                          setDcfAssumptions({
                            ...dcfAssumptions,
                            terminal_growth_rate: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-primary bg-canvas-soft h-1.5 rounded cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-mute">
                        <span>2%</span>
                        <span>5%</span>
                        <span>8%</span>
                      </div>
                    </div>

                    {/* Terminal Method Switcher */}
                    <div className="bg-canvas-card border border-hairline rounded-md p-4 space-y-2">
                      <div className="eyebrow-mono text-mute text-[11px]">TERMINAL VALUE METHOD</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setDcfAssumptions({ ...dcfAssumptions, terminal_method: "GORDON_GROWTH" })
                          }
                          className={`flex-1 py-1.5 text-xs font-mono rounded-sm border transition-colors ${
                            dcfAssumptions.terminal_method === "GORDON_GROWTH"
                              ? "bg-primary text-on-primary border-primary font-semibold"
                              : "bg-canvas-soft text-body border-hairline"
                          }`}
                        >
                          Gordon
                        </button>
                        <button
                          onClick={() =>
                            setDcfAssumptions({ ...dcfAssumptions, terminal_method: "EXIT_MULTIPLE" })
                          }
                          className={`flex-1 py-1.5 text-xs font-mono rounded-sm border transition-colors ${
                            dcfAssumptions.terminal_method === "EXIT_MULTIPLE"
                              ? "bg-primary text-on-primary border-primary font-semibold"
                              : "bg-canvas-soft text-body border-hairline"
                          }`}
                        >
                          Exit Mult
                        </button>
                      </div>
                      {dcfAssumptions.terminal_method === "EXIT_MULTIPLE" && (
                        <div className="flex items-center justify-between text-xs font-mono pt-1">
                          <span className="text-mute">Exit EV/EBITDA:</span>
                          <input
                            type="number"
                            min="5"
                            max="50"
                            step="1"
                            value={dcfAssumptions.exit_multiple || 15}
                            onChange={(e) =>
                              setDcfAssumptions({
                                ...dcfAssumptions,
                                exit_multiple: parseFloat(e.target.value),
                              })
                            }
                            className="w-16 bg-canvas-soft border border-hairline rounded px-1.5 py-0.5 text-right text-ink font-mono"
                          />
                        </div>
                      )}
                    </div>

                    {/* Tax Rate */}
                    <div className="bg-canvas-card border border-hairline rounded-md p-4 space-y-2">
                      <div className="eyebrow-mono text-mute text-[11px] flex justify-between">
                        <span>EFFECTIVE TAX RATE</span>
                        <span className="text-primary font-mono">{(dcfAssumptions.tax_rate * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.15"
                        max="0.35"
                        step="0.01"
                        value={dcfAssumptions.tax_rate}
                        onChange={(e) =>
                          setDcfAssumptions({ ...dcfAssumptions, tax_rate: parseFloat(e.target.value) })
                        }
                        className="w-full accent-primary bg-canvas-soft h-1.5 rounded cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-mute">
                        <span>15%</span>
                        <span>25%</span>
                        <span>35%</span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Year Projections Table */}
                  {customDCFResult && (
                    <div className="bg-canvas-card border border-hairline rounded-md overflow-hidden space-y-3 p-5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-mono font-medium text-ink-strong">
                          Explicit 5-Year Free Cash Flow Projections (₹ Crores)
                        </h4>
                        <span className="text-xs font-mono text-mute">
                          Terminal Method: {customDCFResult.terminal_value_method}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono text-left">
                          <thead>
                            <tr className="border-b border-hairline text-mute bg-canvas-soft">
                              <th className="py-2.5 px-3">METRIC</th>
                              {customDCFResult.projections.map((p) => (
                                <th key={p.year} className="py-2.5 px-3 text-right">
                                  Year +{p.year}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline">
                            <tr>
                              <td className="py-2 px-3 text-mute font-medium">Revenue Growth %</td>
                              {customDCFResult.projections.map((p) => (
                                <td key={p.year} className="py-2 px-3 text-right text-primary">
                                  {p.growth_pct.toFixed(1)}%
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-mute font-medium">Revenue (₹ Cr)</td>
                              {customDCFResult.projections.map((p) => (
                                <td key={p.year} className="py-2 px-3 text-right text-ink">
                                  {p.revenue.toLocaleString()}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-mute font-medium">EBIT (₹ Cr)</td>
                              {customDCFResult.projections.map((p) => (
                                <td key={p.year} className="py-2 px-3 text-right text-ink">
                                  {p.ebit.toLocaleString()}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-mute font-medium">NOPAT (₹ Cr)</td>
                              {customDCFResult.projections.map((p) => (
                                <td key={p.year} className="py-2 px-3 text-right text-ink">
                                  {p.nopat.toLocaleString()}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-canvas-soft/40">
                              <td className="py-2 px-3 text-ink font-semibold">FCFF (₹ Cr)</td>
                              {customDCFResult.projections.map((p) => (
                                <td key={p.year} className="py-2 px-3 text-right font-semibold text-primary">
                                  {p.fcff.toLocaleString()}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-mute font-medium">Discount Factor</td>
                              {customDCFResult.projections.map((p) => (
                                <td key={p.year} className="py-2 px-3 text-right text-mute">
                                  {p.discount_factor.toFixed(4)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-canvas-soft font-semibold">
                              <td className="py-2 px-3 text-ink">PV of FCFF (₹ Cr)</td>
                              {customDCFResult.projections.map((p) => (
                                <td key={p.year} className="py-2 px-3 text-right text-primary">
                                  {p.pv_fcff.toLocaleString()}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Equity Value Bridge */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-hairline">
                        <div className="bg-canvas-soft p-3 rounded border border-hairline">
                          <div className="text-[10px] font-mono text-mute">PV OF FORECASTS</div>
                          <div className="font-mono text-base font-bold text-ink">
                            ₹{customDCFResult.pv_explicit_fcf.toLocaleString()} Cr
                          </div>
                        </div>
                        <div className="bg-canvas-soft p-3 rounded border border-hairline">
                          <div className="text-[10px] font-mono text-mute">PV OF TERMINAL VALUE</div>
                          <div className="font-mono text-base font-bold text-ink">
                            ₹{customDCFResult.pv_terminal_value.toLocaleString()} Cr
                          </div>
                        </div>
                        <div className="bg-canvas-soft p-3 rounded border border-hairline">
                          <div className="text-[10px] font-mono text-mute">ENTERPRISE VALUE</div>
                          <div className="font-mono text-base font-bold text-ink">
                            ₹{customDCFResult.enterprise_value.toLocaleString()} Cr
                          </div>
                        </div>
                        <div className="bg-primary/10 p-3 rounded border border-primary/40">
                          <div className="text-[10px] font-mono text-primary font-semibold">
                            INTRINSIC VALUE / SHARE
                          </div>
                          <div className="font-mono text-xl font-bold text-primary">
                            ₹{customDCFResult.intrinsic_value_per_share.toFixed(2)}
                          </div>
                          <div
                            className={`text-[11px] font-mono ${
                              customDCFResult.margin_of_safety_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {customDCFResult.margin_of_safety_pct >= 0 ? "+" : ""}
                            {customDCFResult.margin_of_safety_pct.toFixed(1)}% vs CMP
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: REVERSE DCF & SENSITIVITY MATRIX                             */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "reverse_dcf" && (
            <div className="space-y-6">
              {/* Reverse DCF Solver Result */}
              {reverseDCFResult && (
                <div className="bg-canvas-card border border-hairline rounded-md p-6 space-y-4">
                  <div className="eyebrow-mono text-primary text-[11px]">MARKET-IMPLIED EXPECTATION</div>
                  <h3 className="text-xl font-normal text-ink-strong">
                    Reverse DCF: What is the current stock price pricing in?
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-canvas-soft p-4 rounded border border-hairline space-y-1">
                      <div className="text-[11px] font-mono text-mute">CURRENT MARKET PRICE</div>
                      <div className="font-mono text-2xl font-bold text-ink">
                        ₹{reverseDCFResult.current_price.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-canvas-soft p-4 rounded border border-hairline space-y-1">
                      <div className="text-[11px] font-mono text-mute">IMPLIED 5Y REVENUE GROWTH</div>
                      <div className="font-mono text-2xl font-bold text-primary">
                        {reverseDCFResult.implied_revenue_growth_pct.toFixed(1)}% / yr
                      </div>
                      <div className="text-[11px] font-mono text-mute">Required constant CAGR</div>
                    </div>
                    <div className="bg-canvas-soft p-4 rounded border border-hairline space-y-1">
                      <div className="text-[11px] font-mono text-mute">HISTORICAL 3Y REVENUE CAGR</div>
                      <div className="font-mono text-2xl font-bold text-ink">
                        {typeof reverseDCFResult.historical_revenue_cagr_pct === "number"
                          ? `${reverseDCFResult.historical_revenue_cagr_pct.toFixed(1)}%`
                          : "N/A"}
                      </div>
                      {typeof reverseDCFResult.growth_gap_pct === "number" && (
                        <div
                          className={`text-[11px] font-mono font-medium ${
                            reverseDCFResult.growth_gap_pct > 0 ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          {reverseDCFResult.growth_gap_pct > 0
                            ? `+${reverseDCFResult.growth_gap_pct.toFixed(1)}% faster than past`
                            : `${reverseDCFResult.growth_gap_pct.toFixed(1)}% vs historical`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 5x5 Sensitivity Matrix Heatmap */}
              {sensitivityResult && (
                <div className="bg-canvas-card border border-hairline rounded-md p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-medium text-ink">
                        5×5 Sensitivity Matrix: WACC vs Terminal Growth
                      </h4>
                      <p className="text-xs text-mute font-mono mt-0.5">
                        Per-share fair values and upside/downside vs CMP (₹{sensitivityResult.current_price.toFixed(2)})
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-950 border border-emerald-500"></span>
                        <span className="text-mute">Undervalued</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-rose-950 border border-rose-500"></span>
                        <span className="text-mute">Overvalued</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-center">
                      <thead>
                        <tr className="border-b border-hairline bg-canvas-soft text-mute">
                          <th className="py-2.5 px-3 text-left">WACC \ g</th>
                          {sensitivityResult.tg_headers.map((tg) => (
                            <th key={tg} className="py-2.5 px-3">
                              {tg.toFixed(1)}%
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {sensitivityResult.matrix.map((row) => (
                          <tr key={row.wacc_pct}>
                            <td className="py-2.5 px-3 text-left font-semibold text-mute bg-canvas-soft">
                              {row.wacc_pct.toFixed(1)}%
                            </td>
                            {row.values.map((cell, idx) => {
                              const isUndervalued = (cell.diff_pct || 0) >= 0;
                              return (
                                <td
                                  key={idx}
                                  className={`py-2 px-3 transition-colors ${
                                    cell.value === null
                                      ? "text-mute bg-canvas-soft/30"
                                      : isUndervalued
                                      ? "bg-emerald-950/20 text-emerald-300 font-medium"
                                      : "bg-rose-950/20 text-rose-300"
                                  }`}
                                >
                                  {cell.value !== null ? (
                                    <div>
                                      <div>₹{cell.value.toFixed(0)}</div>
                                      <div className="text-[10px] opacity-75">
                                        {cell.diff_pct !== null && cell.diff_pct >= 0 ? "+" : ""}
                                        {cell.diff_pct?.toFixed(0)}%
                                      </div>
                                    </div>
                                  ) : (
                                    "N/A"
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: HISTORICAL MULTIPLES                                         */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "multiples" && summary.historical_multiples && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* P/E Bands */}
                <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-4">
                  <div className="eyebrow-mono text-primary text-[11px]">PRICE-TO-EARNINGS (P/E)</div>
                  {summary.historical_multiples.pe.bands ? (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between py-1 border-b border-hairline">
                        <span className="text-mute">Min / 25th:</span>
                        <span>{summary.historical_multiples.pe.bands.min}x / {summary.historical_multiples.pe.bands.p25}x</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-hairline bg-canvas-soft px-2 rounded">
                        <span className="font-semibold text-primary">Median Multiple:</span>
                        <span className="font-bold text-ink">{summary.historical_multiples.pe.bands.median}x</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-hairline">
                        <span className="text-mute">75th / Max:</span>
                        <span>{summary.historical_multiples.pe.bands.p75}x / {summary.historical_multiples.pe.bands.max}x</span>
                      </div>
                      <div className="pt-2">
                        <div className="text-mute text-[11px]">IMPLIED TARGET AT MEDIAN</div>
                        <div className="text-xl font-bold text-primary">
                          ₹{summary.historical_multiples.pe.implied_target_price?.toFixed(2) || "N/A"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-mute font-mono">No historical PE series</div>
                  )}
                </div>

                {/* P/B Bands */}
                <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-4">
                  <div className="eyebrow-mono text-primary text-[11px]">PRICE-TO-BOOK (P/B)</div>
                  {summary.historical_multiples.pb.bands ? (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between py-1 border-b border-hairline">
                        <span className="text-mute">Min / 25th:</span>
                        <span>{summary.historical_multiples.pb.bands.min}x / {summary.historical_multiples.pb.bands.p25}x</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-hairline bg-canvas-soft px-2 rounded">
                        <span className="font-semibold text-primary">Median Multiple:</span>
                        <span className="font-bold text-ink">{summary.historical_multiples.pb.bands.median}x</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-hairline">
                        <span className="text-mute">75th / Max:</span>
                        <span>{summary.historical_multiples.pb.bands.p75}x / {summary.historical_multiples.pb.bands.max}x</span>
                      </div>
                      <div className="pt-2">
                        <div className="text-mute text-[11px]">IMPLIED TARGET AT MEDIAN</div>
                        <div className="text-xl font-bold text-primary">
                          ₹{summary.historical_multiples.pb.implied_target_price?.toFixed(2) || "N/A"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-mute font-mono">No historical PB series</div>
                  )}
                </div>

                {/* EV/EBITDA Bands */}
                <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-4">
                  <div className="eyebrow-mono text-primary text-[11px]">EV / EBITDA</div>
                  {!summary.is_financial_sector && summary.historical_multiples.ev_ebitda.bands ? (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between py-1 border-b border-hairline">
                        <span className="text-mute">Min / 25th:</span>
                        <span>{summary.historical_multiples.ev_ebitda.bands.min}x / {summary.historical_multiples.ev_ebitda.bands.p25}x</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-hairline bg-canvas-soft px-2 rounded">
                        <span className="font-semibold text-primary">Median Multiple:</span>
                        <span className="font-bold text-ink">{summary.historical_multiples.ev_ebitda.bands.median}x</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-hairline">
                        <span className="text-mute">75th / Max:</span>
                        <span>{summary.historical_multiples.ev_ebitda.bands.p75}x / {summary.historical_multiples.ev_ebitda.bands.max}x</span>
                      </div>
                      <div className="pt-2">
                        <div className="text-mute text-[11px]">IMPLIED TARGET AT MEDIAN</div>
                        <div className="text-xl font-bold text-primary">
                          ₹{summary.historical_multiples.ev_ebitda.implied_target_price?.toFixed(2) || "N/A"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400/90 font-mono bg-amber-950/40 p-3 rounded">
                      EV/EBITDA is not applicable for banking institutions.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: DIVIDEND DISCOUNT MODEL (DDM)                                */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "ddm" && (
            <div className="space-y-6">
              {customDDM?.is_applicable ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-4">
                      <h4 className="text-sm font-medium text-ink">DDM Parameters</h4>
                      <div className="space-y-3 text-xs font-mono">
                        <div>
                          <div className="flex justify-between text-mute mb-1">
                            <span>Cost of Equity (Ke):</span>
                            <span className="text-primary font-bold">{(costOfEquity * 100).toFixed(1)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.09"
                            max="0.20"
                            step="0.005"
                            value={costOfEquity}
                            onChange={(e) => setCostOfEquity(parseFloat(e.target.value))}
                            className="w-full accent-primary"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-mute mb-1">
                            <span>Perpetual Dividend Growth Rate:</span>
                            <span className="text-primary font-bold">{(ddmGrowthRate * 100).toFixed(1)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.02"
                            max="0.08"
                            step="0.005"
                            value={ddmGrowthRate}
                            onChange={(e) => setDdmGrowthRate(parseFloat(e.target.value))}
                            className="w-full accent-primary"
                          />
                        </div>
                        <button
                          onClick={handleRecalculateDDM}
                          className="mt-2 w-full py-2 bg-primary text-on-primary rounded font-semibold"
                        >
                          Recalculate DDM
                        </button>
                      </div>
                    </div>

                    <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-4 flex flex-col justify-between">
                      <div>
                        <div className="eyebrow-mono text-primary text-[11px]">DDM INTRINSIC VALUE</div>
                        <div className="font-mono text-3xl font-bold text-ink mt-2">
                          ₹{customDDM.intrinsic_value?.toFixed(2)}
                        </div>
                        <div
                          className={`text-sm font-mono font-medium mt-1 ${
                            (customDDM.margin_of_safety_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {(customDDM.margin_of_safety_pct || 0) >= 0 ? "+" : ""}
                          {customDDM.margin_of_safety_pct?.toFixed(1)}% vs Market Price
                        </div>
                      </div>

                      <div className="text-xs font-mono text-mute border-t border-hairline pt-3">
                        Latest DPS: ₹{customDDM.latest_dps?.toFixed(2) || "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-canvas-card border border-hairline rounded-md text-center space-y-2">
                  <div className="text-sm font-mono text-mute uppercase">Model Bypassed</div>
                  <p className="text-body text-sm">
                    {summary.company_name} has no dividend payout record on file or zero dividend history.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 6: GRAHAM FORMULA                                               */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "graham" && (
            <div className="space-y-6">
              {customGraham?.is_applicable ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-4">
                    <h4 className="text-sm font-medium text-ink">Graham Parameters</h4>
                    <div className="space-y-3 text-xs font-mono">
                      <div>
                        <div className="flex justify-between text-mute mb-1">
                          <span>Expected 7-10Y Growth Rate (g):</span>
                          <span className="text-primary font-bold">{(grahamGrowth * 100).toFixed(1)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.04"
                          max="0.25"
                          step="0.01"
                          value={grahamGrowth}
                          onChange={(e) => setGrahamGrowth(parseFloat(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-mute mb-1">
                          <span>AAA Indian Corporate Bond Yield (Y):</span>
                          <span className="text-primary font-bold">{bondYield.toFixed(2)}%</span>
                        </div>
                        <input
                          type="range"
                          min="5.0"
                          max="9.0"
                          step="0.1"
                          value={bondYield}
                          onChange={(e) => setBondYield(parseFloat(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                      <button
                        onClick={handleRecalculateGraham}
                        className="mt-2 w-full py-2 bg-primary text-on-primary rounded font-semibold"
                      >
                        Recalculate Graham Value
                      </button>
                    </div>
                  </div>

                  <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="eyebrow-mono text-primary text-[11px]">GRAHAM INTRINSIC VALUE</div>
                      <div className="font-mono text-3xl font-bold text-ink mt-2">
                        ₹{customGraham.graham_value?.toFixed(2)}
                      </div>
                      <div
                        className={`text-sm font-mono font-medium mt-1 ${
                          (customGraham.margin_of_safety_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {(customGraham.margin_of_safety_pct || 0) >= 0 ? "+" : ""}
                        {customGraham.margin_of_safety_pct?.toFixed(1)}% vs Market Price
                      </div>
                    </div>

                    <div className="border-t border-hairline pt-3 font-mono text-xs flex justify-between text-mute">
                      <span>Graham Number (√(22.5×EPS×BV)):</span>
                      <span className="text-ink font-bold">
                        ₹{customGraham.graham_number?.toFixed(2) || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-canvas-card border border-hairline rounded-md text-center space-y-2">
                  <div className="text-sm font-mono text-mute uppercase">Model Bypassed</div>
                  <p className="text-body text-sm">
                    Benjamin Graham intrinsic formula requires positive normalized trailing EPS.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 7: SAVED SCENARIOS                                              */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "saved" && (
            <div className="space-y-6">
              {/* Save Scenario Form */}
              <div className="bg-canvas-card border border-hairline rounded-md p-5 space-y-3">
                <h4 className="text-sm font-medium text-ink">Save Current Model Assumptions</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Scenario name (e.g. FY27_EXPANSION_CASE)"
                    value={saveScenarioName}
                    onChange={(e) => setSaveScenarioName(e.target.value)}
                    className="flex-1 bg-canvas-soft border border-hairline rounded-sm px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Investment notes / thesis rationale..."
                    value={saveNotes}
                    onChange={(e) => setSaveNotes(e.target.value)}
                    className="flex-1 bg-canvas-soft border border-hairline rounded-sm px-3 py-2 text-xs text-ink focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleSaveScenario}
                    disabled={isSaving || !saveScenarioName.trim()}
                    className="px-4 py-2 bg-primary text-on-primary rounded-sm text-xs font-mono font-semibold hover:bg-primary-soft transition-colors disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Model"}
                  </button>
                </div>
                {saveSuccessMsg && (
                  <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {saveSuccessMsg}
                  </div>
                )}
              </div>

              {/* Saved List */}
              <div className="bg-canvas-card border border-hairline rounded-md divide-y divide-hairline">
                {savedScenarios.length === 0 ? (
                  <div className="p-8 text-center text-mute text-xs font-mono">
                    No saved scenarios for {summary.company_name} yet.
                  </div>
                ) : (
                  savedScenarios.map((sc) => (
                    <div
                      key={sc.id}
                      className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-canvas-soft/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-primary">
                            {sc.scenario_name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-canvas-soft border border-hairline text-mute">
                            {sc.model_type}
                          </span>
                        </div>
                        {sc.notes && <p className="text-xs text-body">{sc.notes}</p>}
                        <div className="text-[10px] font-mono text-mute">
                          Created {new Date(sc.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-mute">TARGET FAIR VALUE</div>
                          <div className="font-mono text-base font-bold text-ink">
                            ₹{sc.intrinsic_value?.toFixed(2) || "N/A"}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteScenario(sc.id)}
                          className="p-1.5 text-mute hover:text-rose-400 transition-colors"
                          title="Delete scenario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
