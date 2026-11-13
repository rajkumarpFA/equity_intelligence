"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  FileSpreadsheet,
  FileText,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";

import {
  fetchIngestionJobs,
  fetchRejectedRecords,
  fetchScheduledJobs,
  initializeIngestionMetadata,
  runCompanyIntegrityAudit,
  searchCompanies,
  triggerBenchmarkSync,
  uploadReportDocument,
  uploadStatementCsv,
} from "@/lib/api-client";
import type { IngestionJob, IntegrityAuditSummary, RejectedRecord } from "@/types/ingestion";

export function DataManagementView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"jobs" | "upload_csv" | "upload_report" | "rejected" | "integrity">(
    "jobs"
  );

  // CSV Upload state
  const [csvCompanyId, setCsvCompanyId] = useState<number | "">("");
  const [statementType, setStatementType] = useState<string>("INCOME_STATEMENT");
  const [reportingBasis, setReportingBasis] = useState<string>("CONSOLIDATED");
  const [csvUnit, setCsvUnit] = useState<string>("CRORES");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // PDF Upload state
  const [reportCompanyId, setReportCompanyId] = useState<number | "">("");
  const [reportYear, setReportYear] = useState<number>(2024);
  const [reportPeriod, setReportPeriod] = useState<string>("FY");
  const [reportDocType, setReportDocType] = useState<string>("ANNUAL_REPORT");
  const [reportFile, setReportFile] = useState<File | null>(null);

  // Data Integrity state
  const [integrityCompanyId, setIntegrityCompanyId] = useState<number | "">("");
  const [integrityAudit, setIntegrityAudit] = useState<IntegrityAuditSummary | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const handleRunAudit = async () => {
    if (!integrityCompanyId) return;
    setIsRunningAudit(true);
    try {
      const summary = await runCompanyIntegrityAudit(Number(integrityCompanyId));
      setIntegrityAudit(summary);
      setNotification({
        type: summary.is_healthy ? "success" : "error",
        message: summary.is_healthy
          ? `Data Integrity Audit Passed: All ${summary.total_checks} accounting checks validated.`
          : `Data Integrity Audit: Found ${summary.error_checks} error(s) and ${summary.warning_checks} warning(s).`,
      });
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to run integrity audit",
      });
    } finally {
      setIsRunningAudit(false);
    }
  };

  // Queries
  const { data: companiesData } = useQuery({
    queryKey: ["companies_select"],
    queryFn: () => searchCompanies({ page_size: 50 }),
  });

  const {
    data: jobsData,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ["ingestion_jobs"],
    queryFn: () => fetchIngestionJobs({ page_size: 20 }),
    refetchInterval: 5000,
  });

  const {
    data: rejectedData,
    refetch: refetchRejected,
  } = useQuery({
    queryKey: ["rejected_records"],
    queryFn: () => fetchRejectedRecords({ page_size: 20 }),
  });

  const { data: scheduledJobs } = useQuery({
    queryKey: ["scheduled_jobs"],
    queryFn: () => fetchScheduledJobs(),
  });

  // Mutations
  const initMutation = useMutation({
    mutationFn: initializeIngestionMetadata,
    onSuccess: (data) => {
      setNotification({
        type: "success",
        message: `${data.message} (${data.metrics_seeded} metrics, ${data.sources_seeded} sources)`,
      });
      queryClient.invalidateQueries({ queryKey: ["ingestion_jobs"] });
    },
    onError: (err: Error) => {
      setNotification({ type: "error", message: `Initialization failed: ${err.message}` });
    },
  });

  const syncPricesMutation = useMutation({
    mutationFn: () => triggerBenchmarkSync(180),
    onSuccess: (jobs) => {
      setNotification({
        type: "success",
        message: `Successfully synchronized prices across ${jobs.length} benchmark securities!`,
      });
      queryClient.invalidateQueries({ queryKey: ["ingestion_jobs"] });
    },
    onError: (err: Error) => {
      setNotification({ type: "error", message: `Price sync failed: ${err.message}` });
    },
  });

  const csvMutation = useMutation({
    mutationFn: async () => {
      if (!csvFile || !csvCompanyId) throw new Error("Please select a company and a CSV file");
      const formData = new FormData();
      formData.append("file", csvFile);
      formData.append("company_id", csvCompanyId.toString());
      formData.append("statement_type", statementType);
      formData.append("reporting_basis", reportingBasis);
      formData.append("unit", csvUnit);
      return uploadStatementCsv(formData);
    },
    onSuccess: (job: IngestionJob) => {
      setNotification({
        type: "success",
        message: `CSV ingested: Job ${job.id} ${job.status} (${job.records_inserted} inserted, ${job.records_updated} updated, ${job.records_rejected} rejected)`,
      });
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ["ingestion_jobs"] });
      queryClient.invalidateQueries({ queryKey: ["rejected_records"] });
      setActiveTab("jobs");
    },
    onError: (err: Error) => {
      setNotification({ type: "error", message: `CSV upload failed: ${err.message}` });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!reportFile) throw new Error("Please select a report file");
      const formData = new FormData();
      formData.append("file", reportFile);
      if (reportCompanyId) formData.append("company_id", reportCompanyId.toString());
      formData.append("fiscal_year", reportYear.toString());
      formData.append("fiscal_period", reportPeriod);
      formData.append("document_type", reportDocType);
      return uploadReportDocument(formData);
    },
    onSuccess: (doc) => {
      setNotification({
        type: "success",
        message: doc.is_duplicate
          ? `Duplicate detected: File already exists with SHA-256 hash ${doc.sha256_hash.slice(0, 12)}...`
          : `Document uploaded successfully: ${doc.file_name} (SHA-256: ${doc.sha256_hash.slice(0, 12)}...)`,
      });
      setReportFile(null);
      setActiveTab("jobs");
    },
    onError: (err: Error) => {
      setNotification({ type: "error", message: `Report upload failed: ${err.message}` });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Data Management & Ingestion Engine
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Phase 5 Active
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audit ingestion jobs, trigger price synchronization, import CSV disclosures, and review quarantined records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => initMutation.mutate()}
            disabled={initMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            {initMutation.isPending ? "Seeding..." : "Seed Metrics Catalog"}
          </button>

          <button
            onClick={() => syncPricesMutation.mutate()}
            disabled={syncPricesMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {syncPricesMutation.isPending ? "Syncing..." : "Sync Benchmark Prices"}
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100 font-semibold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "jobs"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Activity className="w-4 h-4" />
          Ingestion Jobs ({jobsData?.total ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("upload_csv")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "upload_csv"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Upload Financial CSV
        </button>

        <button
          onClick={() => setActiveTab("upload_report")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "upload_report"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload Annual Report PDF
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "rejected"
              ? "border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Quarantined Records ({rejectedData?.total ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("integrity")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "integrity"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Data Integrity & Accounting Audit
        </button>
      </div>

      {/* Tab 1: Ingestion Jobs Audit Table */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Execution History & Idempotent Audit
            </h2>
            <button
              onClick={() => refetchJobs()}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              title="Refresh Jobs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Job Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Idempotency Key</th>
                  <th className="px-4 py-3 text-right">Processed</th>
                  <th className="px-4 py-3 text-right">Inserted</th>
                  <th className="px-4 py-3 text-right">Updated</th>
                  <th className="px-4 py-3 text-right">Rejected</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {jobsLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Loading ingestion jobs...
                    </td>
                  </tr>
                ) : !jobsData?.items || jobsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No ingestion jobs executed yet. Click &quot;Sync Benchmark Prices&quot; or upload a CSV to start.
                    </td>
                  </tr>
                ) : (
                  jobsData.items.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">#{job.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {job.job_type}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                            job.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                              : job.status === "PARTIAL_SUCCESS"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                              : job.status === "RUNNING"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 animate-pulse"
                              : "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs" title={job.idempotency_key}>
                        {job.idempotency_key}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{job.records_processed}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                        +{job.records_inserted}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                        ~{job.records_updated}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-red-600 dark:text-red-400">
                        {job.records_rejected > 0 ? `!${job.records_rejected}` : 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(job.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Scheduled Background Jobs Section */}
          <div className="mt-8 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Automated Background Schedules (APScheduler)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
              {scheduledJobs && scheduledJobs.length > 0 ? (
                scheduledJobs.map((sched) => (
                  <div key={sched.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-900 dark:text-slate-200">{sched.name}</span>
                    <p className="mt-1 font-mono text-slate-500">{sched.trigger}</p>
                    <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      Next run: {sched.next_run_time ? new Date(sched.next_run_time).toLocaleString() : "Active"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-900 dark:text-slate-200">Daily EOD Price Candlestick Sync</span>
                  <p className="mt-1 font-mono text-slate-500">CronTrigger: Mon-Fri 11:00 UTC (16:30 IST)</p>
                  <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">Status: Running in background</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Upload Financial CSV */}
      {activeTab === "upload_csv" && (
        <div className="max-w-2xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Upload Financial Statement CSV
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports Screener/BSE-style multi-year tabular CSVs or row-based (Metric, Date, Value) disclosures.
              Unrecognized line items are quarantined into Rejected Records without failing the entire batch.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Company *
              </label>
              <select
                value={csvCompanyId}
                onChange={(e) => setCsvCompanyId(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Select Company --</option>
                {companiesData?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.primary_symbol || c.isin})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Statement Type
                </label>
                <select
                  value={statementType}
                  onChange={(e) => setStatementType(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="INCOME_STATEMENT">Income Statement (P&L)</option>
                  <option value="BALANCE_SHEET">Balance Sheet</option>
                  <option value="CASH_FLOW">Cash Flow Statement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reporting Basis
                </label>
                <select
                  value={reportingBasis}
                  onChange={(e) => setReportingBasis(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="CONSOLIDATED">Consolidated</option>
                  <option value="STANDALONE">Standalone</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reported Unit
                </label>
                <select
                  value={csvUnit}
                  onChange={(e) => setCsvUnit(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="CRORES">Crores (Cr)</option>
                  <option value="LAKHS">Lakhs</option>
                  <option value="MILLIONS">Millions</option>
                  <option value="INR">Raw INR</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                CSV File (.csv) *
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 hover:file:bg-indigo-100"
              />
            </div>

            <button
              onClick={() => csvMutation.mutate()}
              disabled={!csvFile || !csvCompanyId || csvMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {csvMutation.isPending ? "Normalizing & Ingesting..." : "Upload & Ingest CSV"}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Upload Annual Report PDF */}
      {activeTab === "upload_report" && (
        <div className="max-w-2xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Upload Annual Report / Filing Document
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Computes SHA-256 checksum for immutable provenance and deduplication. Max file size: 50MB.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Company (Optional)
              </label>
              <select
                value={reportCompanyId}
                onChange={(e) => setReportCompanyId(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- General Filing (Unassigned) --</option>
                {companiesData?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.primary_symbol || c.isin})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Type
                </label>
                <select
                  value={reportDocType}
                  onChange={(e) => setReportDocType(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="ANNUAL_REPORT">Annual Report</option>
                  <option value="QUARTERLY_REPORT">Quarterly Report</option>
                  <option value="INVESTOR_PRESENTATION">Investor Presentation</option>
                  <option value="EXCHANGE_FILING">Exchange Filing</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fiscal Year
                </label>
                <input
                  type="number"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Period
                </label>
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="FY">Full Year (FY)</option>
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Document File (PDF, CSV, TXT) *
              </label>
              <input
                type="file"
                accept=".pdf,.csv,.txt"
                onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 hover:file:bg-indigo-100"
              />
            </div>

            <button
              onClick={() => reportMutation.mutate()}
              disabled={!reportFile || reportMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {reportMutation.isPending ? "Uploading & Hashing..." : "Upload & Store Audit Document"}
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Quarantined & Rejected Records */}
      {activeTab === "rejected" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Quarantined Rejected Records
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Zero silent data loss: Any corrupt number, unparseable date, or unrecognized metric label is quarantined here with raw payload.
              </p>
            </div>
            <button
              onClick={() => refetchRejected()}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              title="Refresh Quarantined Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Job ID</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">Rejection Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {!rejectedData?.items || rejectedData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No quarantined records! All ingested items passed validation.
                    </td>
                  </tr>
                ) : (
                  rejectedData.items.map((rec: RejectedRecord) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">#{rec.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {rec.ingestion_job_id ? `#${rec.ingestion_job_id}` : "N/A"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs text-slate-700 dark:text-slate-300">
                        {rec.entity_type}
                      </td>
                      <td className="px-4 py-3 text-xs text-red-600 dark:text-red-400 font-medium">
                        {rec.rejection_reason}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {rec.review_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(rec.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Data Integrity & Accounting Audit */}
      {activeTab === "integrity" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Fundamental Accounting Verification & Integrity Engine
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Execute multi-dimensional mathematical audits: Balance Sheet identity, Cash Flow reconciliations, YoY anomaly checks, and restatement audits.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <select
                value={integrityCompanyId}
                onChange={(e) => setIntegrityCompanyId(e.target.value ? Number(e.target.value) : "")}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select Company to Audit...</option>
                {companiesData?.items?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.primary_symbol || c.isin})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isRunningAudit || !integrityCompanyId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {isRunningAudit ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                <span>{isRunningAudit ? "Running Verification Rules..." : "Run Accounting Audit"}</span>
              </button>
            </div>
          </div>

          {integrityAudit && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Total Checks</span>
                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {integrityAudit.total_checks}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-950 dark:bg-emerald-950/20">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">Passed Checks</span>
                  <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {integrityAudit.passed_checks}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-950 dark:bg-amber-950/20">
                  <span className="text-xs text-amber-700 dark:text-amber-400">Warnings</span>
                  <div className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {integrityAudit.warning_checks}
                  </div>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm dark:border-rose-950 dark:bg-rose-950/20">
                  <span className="text-xs text-rose-700 dark:text-rose-400">Critical Errors</span>
                  <div className="mt-1 text-2xl font-bold text-rose-700 dark:text-rose-300">
                    {integrityAudit.error_checks}
                  </div>
                </div>
              </div>

              {/* Integrity Checklist Table */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Verification Findings for {integrityAudit.company_name}
                </h3>
                <div className="space-y-2">
                  {integrityAudit.results.map((r, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start justify-between gap-3 p-3 rounded-lg border text-xs ${
                        r.passed
                          ? "border-emerald-100 bg-emerald-50/40 dark:border-emerald-950 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200"
                          : r.severity === "WARNING"
                          ? "border-amber-100 bg-amber-50/40 dark:border-amber-950 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
                          : "border-red-100 bg-red-50/40 dark:border-red-950 dark:bg-red-950/20 text-red-900 dark:text-red-200"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {r.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : r.severity === "WARNING" ? (
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-semibold">{r.rule_code}</div>
                          <div className="mt-0.5 opacity-90">{r.message}</div>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase font-bold opacity-75 shrink-0">
                        {r.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
