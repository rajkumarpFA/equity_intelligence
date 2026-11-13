export interface IngestionJob {
  id: number;
  job_type: string;
  source_id: number;
  company_id?: number | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL_SUCCESS";
  idempotency_key: string;
  retry_count: number;
  max_retries: number;
  started_at?: string | null;
  completed_at?: string | null;
  records_processed: number;
  records_inserted: number;
  records_updated: number;
  records_rejected: number;
  error_message?: string | null;
  execution_metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface IngestionJobListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: IngestionJob[];
}

export interface RejectedRecord {
  id: number;
  ingestion_job_id?: number | null;
  source_id?: number | null;
  entity_type: string;
  rejection_reason: string;
  raw_payload?: Record<string, unknown> | null;
  review_status: "UNRESOLVED" | "DISMISSED" | "RESOLVED";
  created_at: string;
}

export interface RejectedRecordListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: RejectedRecord[];
}

export interface SourceDocument {
  id: number;
  sha256_hash: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  document_type: string;
  company_id?: number | null;
  fiscal_year?: number | null;
  fiscal_period?: string | null;
  upload_timestamp: string;
  is_duplicate: boolean;
}

export interface RuleResultItem {
  rule_code: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  passed: boolean;
  message: string;
  entity_type: string;
  entity_id?: number | null;
  details?: Record<string, unknown>;
}

export interface IntegrityAuditSummary {
  company_id: number;
  company_name: string;
  total_checks: number;
  passed_checks: number;
  warning_checks: number;
  error_checks: number;
  is_healthy: boolean;
  results: RuleResultItem[];
}

export interface ValidationRecordItem {
  id: number;
  rule_code: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  entity_type: string;
  entity_id?: number | null;
  message: string;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface ScheduledJob {
  id: string;
  name: string;
  next_run_time?: string | null;
  trigger: string;
}
