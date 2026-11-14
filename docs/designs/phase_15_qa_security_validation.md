# Phase 15 Technical Specification: Full QA, Security & Deployment Validation (Hardened)

- **Author**: Elephant (Root Agent)
- **Reviewer**: Goldfish Reviewer Subagent (`egm-implementation-readiness`)
- **Status**: Approved Post-Audit
- **Target Branch**: `development`
- **Date**: 2026-11-14

---

## 1. Executive Summary & Objective

Phase 15 is the comprehensive Quality Assurance, Security Hardening, and Deployment Validation phase of the Equity Intelligence platform. Having completed all functional domains across Phases 1 through 14, Phase 15 validates end-to-end operational resilience, browser-level user workflows, security posture, and data persistence before final release packaging in Phase 16.

Following the Goldfish audit by `egm-implementation-readiness`, this specification incorporates strict file upload sanitization (fixing the boolean bypass and securing the portfolio CSV endpoint), non-destructive database backup/restore validation via `pg_restore --list`, security middleware headers, sanitized database credentials, and resilient Playwright E2E testing without `networkidle` anti-patterns.

---

## 2. Architecture & Scope Breakdown

```mermaid
flowchart TD
    subgraph TestGates["Mandatory Phase 15 Verification Gates"]
        direction TB
        E2E["1. Playwright E2E Workflows<br/>(11 Routes, Company Dossier, Valuation, Portfolio)"]
        SEC["2. Security Hardening Suite<br/>(CORS, SQLi, Hardened Uploads, Headers, Secret Masking)"]
        REG["3. Full Regression Suite<br/>(Pytest 125+ Tests, Vitest 51+ Tests, TSC)"]
        OPS["4. Non-Destructive Backup Ops<br/>(Backup Creation & TOC Verification)"]
    end

    E2E --> Gate{"Phase 15 Gate Sign-off"}
    SEC --> Gate
    REG --> Gate
    OPS --> Gate
    Gate --> Release["Phase 16 Release Packaging"]
```

### 2.1 Component 1: Playwright End-to-End (E2E) Test Suite
- **Runtime Environment**:
  - Google Chrome 157 (`/usr/bin/google-chrome`) via Playwright's `chromium` engine.
  - Linux flags: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`.
  - Base URL: `http://localhost:3000`.
  - Server orchestration: Reuses existing running servers or invokes `pnpm start`.
- **Timing & Waiting Standards**:
  - **No `networkidle`**: Next.js 14 App Router prefetching causes intermittent network activity. Tests strictly use web-first assertions (`await expect(locator).toBeVisible({ timeout: 10000 })`) and explicit response predicates (`page.waitForResponse(...)`).
- **E2E Test Specifications (`frontend/e2e/user-flows.spec.ts`)**:
  1. **Route Traversal & Layout Integrity**:
     - Verify navigation across all 11 sidebar links:
       - `/` (Home Dashboard)
       - `/discover` (Stock Discovery)
       - `/screener` (Stock Screener)
       - `/companies` (Companies Directory)
       - `/compare` (Peer Comparison)
       - `/valuation` (Valuation Workbench)
       - `/watchlists` (Watchlists)
       - `/journal` (Investment Journal)
       - `/portfolio` (Portfolio Analytics)
       - `/data-management` (Data Management)
       - `/settings` (Settings)
     - Assert active navigation item receives `aria-current="page"` and `text-white bg-[var(--accent)]`.
     - Assert no uncaught JavaScript runtime errors in console.
  2. **Company Research Dossier Flow**:
     - Navigate to `/companies/1`.
     - Verify Company Header renders ISIN, Sector, Industry badges, and Standalone / Consolidated toggle button.
     - Switch between Standalone and Consolidated views; assert statement tables re-render with appropriate badges.
     - Click on Provenance/Traceability button to open data source provenance modal; assert that data source, filing date, and verification status are visible.
  3. **Valuation Workbench Flow**:
     - Navigate to `/valuation`.
     - Select a benchmark company (e.g., Reliance Industries).
     - Modify DCF assumptions (Discount Rate / WACC, Terminal Growth Rate).
     - Trigger DCF recalculation; assert that Intrinsic Value per share and Margin of Safety calculate dynamically.
     - Verify Sensitivity Matrix displays the 2D grid of discount rates vs terminal growth rates without layout breakages.
  4. **Portfolio Analytics & Tracking Flow**:
     - Navigate to `/portfolio`.
     - Create a test portfolio via "New Portfolio" modal.
     - Log a new BUY transaction for a verified stock.
     - Assert that the Portfolio Holdings table updates with the newly acquired security, quantity, and average buy price.
     - Open the Transaction Ledger drawer; assert that the BUY record is displayed with correct timestamp, quantity, and price.

---

### 2.2 Component 2: Security & Hardening Remediation & Audit Suite

1. **Strict CORS Origin Enforcement**:
   - Verify that requests with allowed origin (`http://localhost:3000`) receive `Access-Control-Allow-Origin: http://localhost:3000`.
   - Verify that requests with unauthorized external origins (e.g., `http://malicious-site.com`, `http://attacker.xyz`) do not receive access-control grant headers.
   - Assert wildcard `*` is not used in conjunction with credentialed requests.

2. **Security Headers Middleware**:
   - Add HTTP middleware in `backend/app/main.py`:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`

3. **File Upload Hardening**:
   - **Fix Boolean Logic Bypass in `ingestion_service.py`**:
     - Check file extension against `allowed_extensions` independently (`ext not in allowed_extensions -> raise ValueError`).
     - Check MIME type against `allowed_mimes` independently (`mime not in allowed_mimes -> raise ValueError`).
     - Enforce magic bytes verification for PDF files (`file_bytes.startswith(b"%PDF-")`).
   - **Harden Portfolio CSV Endpoint (`portfolio.py`)**:
     - Enforce file extension check (`.csv`).
     - Enforce file size bounds against `settings.max_upload_size_mb`.
     - Reject oversized uploads with `HTTP 413 Payload Too Large`.
     - Catch `ValueError` on oversized payloads in `ingestion.py` and return `HTTP 413`.
   - **Path Traversal Sanitization**:
     - Strip directory paths via `os.path.basename` / `pathlib.Path(filename).name` before storage.

4. **SQL Injection Parameterization Audit**:
   - Static AST / regex analysis scanning all Python files in `backend/app/repositories/`, `backend/app/services/`, and `backend/app/calculations/`.
   - Verify zero raw string interpolations in database executions.
   - Integration tests executing API queries with SQL injection payloads (`' OR '1'='1`, `'; DROP TABLE companies; --`).

5. **Secret & Credential Masking**:
   - Mask passwords in `database_url` representations (`postgresql+psycopg://user:***@host:port/db`).
   - Wrap sensitive fields in `SecretStr`.
   - Verify that logging output and error messages never display raw database or API secrets.

---

### 2.3 Component 3: Container & Persistence Verification

1. **Non-Destructive Backup & Restore Verification (`scripts/test_backup_restore.sh`)**:
   - Executes backup procedure to generate timestamped archive (`equity_intelligence_YYYYMMDD_HHMMSS.dump`).
   - Verifies that the archive is non-empty.
   - **Crucial Non-Destructive Check**: Executes `pg_restore --list <dump_file>` to verify the PostgreSQL Table of Contents archive integrity without overwriting or wiping the active database.
   - Verifies tar archive integrity of storage volume.

---

### 2.4 Component 4: Full Regression & Quality Gates

To mark Phase 15 complete, all 4 test suites must pass simultaneously:
1. **Backend Unit, Integration & Security Tests**: `cd backend && uv run pytest`
2. **Frontend Unit & Component Tests**: `cd frontend && pnpm vitest run`
3. **Frontend TypeScript Typecheck**: `cd frontend && pnpm tsc --noEmit`
4. **Playwright E2E Tests**: `cd frontend && pnpm test:e2e`
