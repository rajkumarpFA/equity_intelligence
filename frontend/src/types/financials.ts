/**
 * TypeScript types for financial statements, provenance, corporate actions, and documents.
 */

export interface StatementPeriodHeader {
  statement_id: number;
  fiscal_year: number;
  fiscal_quarter?: number | null;
  period_type: "ANNUAL" | "QUARTERLY" | "HALF_YEARLY";
  period_end: string;
  publication_date?: string | null;
  is_audited: boolean;
  is_restated: boolean;
  version: number;
  display_label: string; // E.g. "FY2024" or "Q3 FY24"
}

export interface FactProvenanceDetail {
  fact_id: number;
  metric_code: string;
  metric_name: string;
  category: string;
  value?: number | null;
  formatted_value?: string | null;
  raw_value?: string | null;
  raw_label?: string | null;
  currency: string;
  unit: string;
  line_number?: number | null;
  source_document_id?: number | null;
  source_document_name?: string | null;
  source_document_hash?: string | null;
  validation_status: string;
  is_restated: boolean;
  extraction_timestamp?: string | null;
}

export interface StatementRow {
  metric_code: string;
  metric_name: string;
  category: string;
  normal_balance: string;
  unit: string;
  is_banking_specific: boolean;
  values: Record<string, number | null>;
  details: Record<string, FactProvenanceDetail | null>;
}

export interface FinancialStatementMatrixResponse {
  company_id: number;
  company_name: string;
  isin: string;
  statement_type: "INCOME_STATEMENT" | "BALANCE_SHEET" | "CASH_FLOW";
  reporting_basis: "CONSOLIDATED" | "STANDALONE";
  period_type: "ANNUAL" | "QUARTERLY";
  periods: StatementPeriodHeader[];
  rows: StatementRow[];
  available_bases: string[];
  available_period_types: string[];
}

export interface CorporateActionDetail {
  id: number;
  company_id: number;
  action_type: "DIVIDEND" | "SPLIT" | "BONUS" | "RIGHTS" | "BUYBACK" | string;
  announcement_date?: string | null;
  ex_date?: string | null;
  record_date?: string | null;
  ratio_numerator?: number | null;
  ratio_denominator?: number | null;
  dividend_amount?: number | null;
  currency: string;
  notes?: string | null;
  action_summary?: string | null;
}

export interface ShareholdingPatternDetail {
  id: number;
  company_id: number;
  period_end: string;
  period_label?: string | null;
  promoter_pct: number;
  promoter_pledged_pct: number;
  fii_pct: number;
  dii_pct: number;
  public_pct: number;
  others_pct: number;
}

export interface AvailablePeriodsResponse {
  company_id: number;
  has_consolidated: boolean;
  has_standalone: boolean;
  has_annual: boolean;
  has_quarterly: boolean;
  statement_types_available: string[];
}

export interface SourceDocumentItem {
  id: number;
  sha256_hash: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  document_type: string;
  company_id?: number | null;
  company_name?: string | null;
  company_symbol?: string | null;
  fiscal_year?: number | null;
  fiscal_period?: string | null;
  upload_timestamp: string;
  is_duplicate: boolean;
}

export interface SourceDocumentListResponse {
  total: number;
  items: SourceDocumentItem[];
}
