import type { HealthResponse } from "@/types/health";
import type {
  CompanyRead,
  CompanySearchResponse,
  SectorRead,
} from "@/types/company";
import type {
  IngestionJob,
  IngestionJobListResponse,
  IntegrityAuditSummary,
  RejectedRecordListResponse,
  ScheduledJob,
  SourceDocument,
  ValidationRecordItem,
} from "@/types/ingestion";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      `API request failed (${response.status})`,
      response.status,
      data
    );
  }
  return data as T;
}

export async function fetchSystemHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health", { cache: "no-store" });
}

export async function searchCompanies(params: {
  q?: string;
  sector_id?: number;
  exchange?: string;
  page?: number;
  page_size?: number;
  refresh?: boolean;
}): Promise<CompanySearchResponse> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.sector_id) searchParams.set("sector_id", params.sector_id.toString());
  if (params.exchange) searchParams.set("exchange", params.exchange);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.page_size) searchParams.set("page_size", params.page_size.toString());
  if (params.refresh) searchParams.set("refresh", "true");

  const queryStr = searchParams.toString();
  return apiFetch<CompanySearchResponse>(`/companies${queryStr ? `?${queryStr}` : ""}`);
}

export async function fetchSectors(): Promise<SectorRead[]> {
  return apiFetch<SectorRead[]>("/companies/taxonomy/sectors");
}

export async function fetchCompanyById(id: number, refresh?: boolean): Promise<CompanyRead> {
  return apiFetch<CompanyRead>(`/companies/${id}${refresh ? "?refresh=true" : ""}`);
}

export async function seedBenchmarkUniverse(): Promise<{ status: string; seeded_companies_count: number }> {
  return apiFetch<{ status: string; seeded_companies_count: number }>("/companies/seed", {
    method: "POST",
  });
}

export async function lookupAndAddCompany(
  symbol: string,
  exchange: string = "NSE"
): Promise<CompanyRead> {
  return apiFetch<CompanyRead>(
    `/companies/lookup-and-add?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}`,
    {
      method: "POST",
    }
  );
}

// ---------------------------------------------------------
// Ingestion Pipeline APIs (Phase 5)
// ---------------------------------------------------------

export async function initializeIngestionMetadata(): Promise<{
  message: string;
  metrics_seeded: number;
  sources_seeded: number;
}> {
  return apiFetch("/ingestion/initialize", { method: "POST" });
}

export async function fetchIngestionJobs(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  job_type?: string;
}): Promise<IngestionJobListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
  if (params?.status) searchParams.set("status", params.status);
  if (params?.job_type) searchParams.set("job_type", params.job_type);

  const queryStr = searchParams.toString();
  return apiFetch<IngestionJobListResponse>(`/ingestion/jobs${queryStr ? `?${queryStr}` : ""}`);
}

export async function fetchJobById(jobId: number): Promise<IngestionJob> {
  return apiFetch<IngestionJob>(`/ingestion/jobs/${jobId}`);
}

export async function triggerPriceSync(data: {
  security_id: number;
  days?: number;
  provider_name?: string;
  allow_reexecution?: boolean;
}): Promise<IngestionJob> {
  return apiFetch<IngestionJob>("/ingestion/trigger/price-sync", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function triggerBenchmarkSync(days: number = 180): Promise<IngestionJob[]> {
  return apiFetch<IngestionJob[]>("/ingestion/trigger/benchmark-sync", {
    method: "POST",
    body: JSON.stringify({ days }),
  });
}

export async function uploadStatementCsv(formData: FormData): Promise<IngestionJob> {
  return apiFetch<IngestionJob>("/ingestion/upload/csv", {
    method: "POST",
    body: formData,
  });
}

export const uploadCsvStatement = uploadStatementCsv;

export async function uploadReportDocument(formData: FormData): Promise<SourceDocument> {
  return apiFetch<SourceDocument>("/ingestion/upload/report", {
    method: "POST",
    body: formData,
  });
}

export async function fetchRejectedRecords(params?: {
  page?: number;
  page_size?: number;
  review_status?: string;
  job_id?: number;
}): Promise<RejectedRecordListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
  if (params?.review_status) searchParams.set("review_status", params.review_status);
  if (params?.job_id) searchParams.set("job_id", params.job_id.toString());

  const queryStr = searchParams.toString();
  return apiFetch<RejectedRecordListResponse>(
    `/ingestion/rejected-records${queryStr ? `?${queryStr}` : ""}`
  );
}

export async function fetchScheduledJobs(): Promise<ScheduledJob[]> {
  return apiFetch<ScheduledJob[]>("/ingestion/scheduled-jobs");
}

// ---------------------------------------------------------
// Data Integrity & Accounting Verification APIs (Phase 6)
// ---------------------------------------------------------

export async function runCompanyIntegrityAudit(
  companyId: number
): Promise<IntegrityAuditSummary> {
  return apiFetch<IntegrityAuditSummary>(
    `/integrity/validate/company/${companyId}`,
    {
      method: "POST",
    }
  );
}

export async function fetchCompanyValidationResults(
  companyId: number,
  limit: number = 50
): Promise<ValidationRecordItem[]> {
  return apiFetch<ValidationRecordItem[]>(
    `/integrity/results/company/${companyId}?limit=${limit}`
  );
}

export async function adjustPricesForCorporateActions(
  securityId: number
): Promise<{
  status: string;
  security_id: number;
  updated_candles: number;
  message: string;
}> {
  return apiFetch(
    `/integrity/corporate-actions/adjust-prices/${securityId}`,
    {
      method: "POST",
    }
  );
}
