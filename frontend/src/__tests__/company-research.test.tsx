import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { StatementViewer } from "@/components/company/StatementViewer";
import { CorporateActionsTable } from "@/components/company/CorporateActionsTable";
import { ShareholdingViewer } from "@/components/company/ShareholdingViewer";
import { CompanyDocumentsLibrary } from "@/components/company/CompanyDocumentsLibrary";

// Mock API Client
vi.mock("@/lib/api-client", () => ({
  fetchAvailableStatementPeriods: vi.fn().mockResolvedValue({
    company_id: 1,
    has_consolidated: true,
    has_standalone: true,
    has_annual: true,
    has_quarterly: false,
    statement_types_available: ["INCOME_STATEMENT", "BALANCE_SHEET", "CASH_FLOW"],
  }),
  fetchCompanyStatements: vi.fn().mockResolvedValue({
    company_id: 1,
    company_name: "Reliance Industries Limited",
    isin: "INE002A01018",
    statement_type: "INCOME_STATEMENT",
    reporting_basis: "CONSOLIDATED",
    period_type: "ANNUAL",
    periods: [
      {
        statement_id: 101,
        fiscal_year: 2022,
        period_type: "ANNUAL",
        period_end: "2022-03-31",
        is_audited: true,
        is_restated: false,
        version: 1,
        display_label: "FY2022",
      },
      {
        statement_id: 102,
        fiscal_year: 2023,
        period_type: "ANNUAL",
        period_end: "2023-03-31",
        is_audited: true,
        is_restated: false,
        version: 1,
        display_label: "FY2023",
      },
      {
        statement_id: 103,
        fiscal_year: 2024,
        period_type: "ANNUAL",
        period_end: "2024-03-31",
        is_audited: true,
        is_restated: false,
        version: 1,
        display_label: "FY2024",
      },
    ],
    rows: [
      {
        metric_code: "REVENUE",
        metric_name: "Revenue from Operations",
        category: "INCOME_STATEMENT",
        normal_balance: "CREDIT",
        unit: "CRORES",
        is_banking_specific: false,
        values: {
          FY2022: 699962.0,
          FY2023: 877835.0,
          FY2024: 899011.0,
        },
        details: {
          FY2024: {
            fact_id: 501,
            metric_code: "REVENUE",
            metric_name: "Revenue from Operations",
            category: "INCOME_STATEMENT",
            value: 899011.0,
            formatted_value: "₹8,99,011.00 Cr",
            raw_value: "899011.00",
            raw_label: "Revenue from operations (net)",
            currency: "INR",
            unit: "CRORES",
            line_number: 45,
            source_document_id: 99,
            source_document_name: "Reliance_Annual_Report_2024.pdf",
            source_document_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
            validation_status: "VERIFIED",
            is_restated: false,
            extraction_timestamp: "2026-11-13T06:00:00Z",
          },
        },
      },
      {
        metric_code: "PAT",
        metric_name: "Profit After Tax (Net Profit)",
        category: "INCOME_STATEMENT",
        normal_balance: "CREDIT",
        unit: "CRORES",
        is_banking_specific: false,
        values: {
          FY2022: 67845.0,
          FY2023: 74088.0,
          FY2024: 79020.0,
        },
        details: {},
      },
      {
        metric_code: "EPS",
        metric_name: "Basic Earnings Per Share",
        category: "INCOME_STATEMENT",
        normal_balance: "CREDIT",
        unit: "PER_SHARE",
        is_banking_specific: false,
        values: {
          FY2022: 100.32,
          FY2023: 109.52,
          FY2024: 116.8,
        },
        details: {},
      },
    ],
    available_bases: ["CONSOLIDATED", "STANDALONE"],
    available_period_types: ["ANNUAL"],
  }),
  fetchCompanyCorporateActions: vi.fn().mockResolvedValue([
    {
      id: 1,
      company_id: 1,
      action_type: "BONUS",
      ex_date: "2024-10-28",
      record_date: "2024-10-29",
      ratio_numerator: 1.0,
      ratio_denominator: 1.0,
      action_summary: "Bonus Issue 1:1",
    },
    {
      id: 2,
      company_id: 1,
      action_type: "DIVIDEND",
      ex_date: "2024-08-19",
      record_date: "2024-08-20",
      dividend_amount: 10.0,
      action_summary: "Dividend of ₹10.00 per share",
    },
  ]),
  fetchCompanyShareholding: vi.fn().mockResolvedValue([
    {
      id: 1,
      company_id: 1,
      period_end: "2024-06-30",
      period_label: "Jun 2024",
      promoter_pct: 50.31,
      promoter_pledged_pct: 0.0,
      fii_pct: 22.45,
      dii_pct: 16.12,
      public_pct: 11.12,
      others_pct: 0.0,
    },
  ]),
  fetchSourceDocuments: vi.fn().mockResolvedValue({
    total: 1,
    items: [
      {
        id: 99,
        file_name: "Reliance_Annual_Report_2024.pdf",
        sha256_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
        file_size_bytes: 5242880,
        mime_type: "application/pdf",
        document_type: "ANNUAL_REPORT",
        company_id: 1,
        fiscal_year: 2024,
        upload_timestamp: "2026-11-13T06:00:00Z",
      },
    ],
  }),
  getDocumentDownloadUrl: vi.fn().mockReturnValue("http://localhost:8000/api/v1/ingestion/documents/99/download"),
  seedCompanyFinancials: vi.fn().mockResolvedValue({ status: "success" }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Company Research UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders StatementViewer with multi-period matrix and triggers provenance drawer on cell click", async () => {
    renderWithClient(
      <StatementViewer companyId={1} companyName="Reliance Industries Limited" />
    );

    // Verify statement tab buttons
    expect(screen.getByText("Profit & Loss (P&L)")).toBeInTheDocument();
    expect(screen.getByText("Balance Sheet")).toBeInTheDocument();
    expect(screen.getByText("Cash Flow")).toBeInTheDocument();

    // Verify periods load
    expect(await screen.findByText("FY2022")).toBeInTheDocument();
    expect(await screen.findByText("FY2023")).toBeInTheDocument();
    expect(await screen.findByText("FY2024")).toBeInTheDocument();

    // Verify metric rows render
    expect(screen.getByText("Revenue from Operations")).toBeInTheDocument();
    expect(screen.getByText("Profit After Tax (Net Profit)")).toBeInTheDocument();
    expect(screen.getByText("Basic Earnings Per Share")).toBeInTheDocument();

    // Click on cell with provenance
    const cellValue = screen.getByText("₹8,99,011.00");
    fireEvent.click(cellValue);

    // Provenance drawer should open
    expect(await screen.findByText("Audit & Source Provenance")).toBeInTheDocument();
    expect(screen.getByText("Raw As-Filed Value:")).toBeInTheDocument();
    expect(screen.getByText("899011.00")).toBeInTheDocument();
    expect(screen.getByText("Reliance_Annual_Report_2024.pdf")).toBeInTheDocument();
  });

  it("renders CorporateActionsTable with dividend and bonus issue rows", async () => {
    renderWithClient(
      <CorporateActionsTable companyId={1} companyName="Reliance Industries Limited" />
    );

    expect(await screen.findByText("Bonus Issue")).toBeInTheDocument();
    expect(await screen.findByText("Dividend")).toBeInTheDocument();
    expect(screen.getByText("1:1")).toBeInTheDocument();
    expect(screen.getByText("₹10.00 / share")).toBeInTheDocument();
  });

  it("renders ShareholdingViewer with promoter and institutional ownership breakdown", async () => {
    renderWithClient(
      <ShareholdingViewer companyId={1} companyName="Reliance Industries Limited" />
    );

    expect(await screen.findByText("Promoter Holding")).toBeInTheDocument();
    expect(screen.getAllByText("50.31%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("22.45%").length).toBeGreaterThan(0); // FII
    expect(screen.getAllByText("16.12%").length).toBeGreaterThan(0); // DII
    expect(screen.getAllByText("11.12%").length).toBeGreaterThan(0); // Public
  });

  it("renders CompanyDocumentsLibrary with uploaded annual reports and download links", async () => {
    renderWithClient(
      <CompanyDocumentsLibrary companyId={1} companyName="Reliance Industries Limited" />
    );

    expect(await screen.findByText("Annual Reports & Filings Library")).toBeInTheDocument();
    expect(await screen.findByText("Reliance_Annual_Report_2024.pdf")).toBeInTheDocument();
    expect(screen.getByText("5.00 MB")).toBeInTheDocument();
    expect(screen.getByText("Download / View")).toBeInTheDocument();
  });
});
