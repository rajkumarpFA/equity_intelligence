import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { DataManagementView } from "@/components/data-management/DataManagementView";

// Mock the API client functions
vi.mock("@/lib/api-client", () => ({
  fetchIngestionJobs: vi.fn().mockResolvedValue({
    total: 1,
    page: 1,
    page_size: 20,
    total_pages: 1,
    items: [
      {
        id: 1,
        job_type: "PRICE_SYNC",
        source_id: 1,
        status: "COMPLETED",
        idempotency_key: "PRICE_SYNC:RELIANCE:30D:2026-11-13",
        retry_count: 0,
        max_retries: 3,
        records_processed: 30,
        records_inserted: 30,
        records_updated: 0,
        records_rejected: 0,
        created_at: "2026-11-13T05:00:00Z",
      },
    ],
  }),
  fetchRejectedRecords: vi.fn().mockResolvedValue({
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
    items: [],
  }),
  fetchScheduledJobs: vi.fn().mockResolvedValue([
    {
      id: "eod_price_sync",
      name: "Daily EOD Price Candlestick Sync",
      trigger: "CronTrigger: Mon-Fri 11:00 UTC",
      next_run_time: "2026-11-13T11:00:00Z",
    },
  ]),
  searchCompanies: vi.fn().mockResolvedValue({
    total: 1,
    page: 1,
    page_size: 50,
    total_pages: 1,
    items: [
      {
        id: 1,
        name: "Reliance Industries Limited",
        isin: "INE002A01018",
        primary_symbol: "RELIANCE",
        securities: [],
        exchange_listings: ["NSE"],
      },
    ],
  }),
  initializeIngestionMetadata: vi.fn().mockResolvedValue({
    message: "Seeded",
    metrics_seeded: 36,
    sources_seeded: 6,
  }),
  triggerBenchmarkSync: vi.fn().mockResolvedValue([]),
  uploadCsvStatement: vi.fn().mockResolvedValue({ id: 2, status: "COMPLETED" }),
  uploadReportDocument: vi.fn().mockResolvedValue({ id: 1, is_duplicate: false }),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("DataManagementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header, buttons, and jobs tab by default", async () => {
    renderWithQueryClient(<DataManagementView />);

    expect(
      screen.getByText("Data Management & Ingestion Engine")
    ).toBeInTheDocument();
    expect(screen.getByText("Seed Metrics Catalog")).toBeInTheDocument();
    expect(screen.getByText("Sync Benchmark Prices")).toBeInTheDocument();

    // Verify async query loads jobs count and job item
    expect(await screen.findByText(/Ingestion Jobs \(1\)/i)).toBeInTheDocument();
    expect(await screen.findByText("PRICE_SYNC")).toBeInTheDocument();
    expect(await screen.findByText("COMPLETED")).toBeInTheDocument();
  });

  it("switches tabs to CSV upload and report upload", async () => {
    renderWithQueryClient(<DataManagementView />);

    // Click Upload Financial CSV tab
    const csvTab = screen.getByText("Upload Financial CSV");
    fireEvent.click(csvTab);

    expect(
      await screen.findByText("Upload Financial Statement CSV")
    ).toBeInTheDocument();
    expect(screen.getByText("Target Company *")).toBeInTheDocument();

    // Click Upload Annual Report PDF tab
    const reportTab = screen.getByText("Upload Annual Report PDF");
    fireEvent.click(reportTab);

    expect(
      await screen.findByText("Upload Annual Report / Filing Document")
    ).toBeInTheDocument();
  });
});
