"""Integration tests for Phase 7: Financial Statements, Multi-Period Matrix, Corporate Actions, and Documents Library."""

import io

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.company import Company, Exchange, Security


def test_seed_and_query_statements_matrix(db_session: Session, client: TestClient):
    """Test seeding and querying multi-period financial statement matrices with provenance."""
    # 1. Setup Company
    ex = Exchange(code="NSE", name="National Stock Exchange")
    db_session.add(ex)
    db_session.flush()

    comp = Company(
        name="Tata Power Company Ltd",
        isin="INE245A01021",
        is_financial_sector=False,
    )
    db_session.add(comp)
    db_session.flush()

    sec = Security(
        company_id=comp.id,
        exchange_id=ex.id,
        symbol="TATAPOWER",
        is_primary=True,
    )
    db_session.add(sec)
    db_session.commit()

    # 2. Seed Financials via API
    seed_resp = client.post(f"/api/v1/companies/{comp.id}/seed-financials")
    assert seed_resp.status_code == 200
    seed_data = seed_resp.json()
    assert seed_data["status"] == "success"
    assert seed_data["statements_created"] >= 6  # 3 IS + 3 BS + 3 CF
    assert seed_data["facts_created"] >= 30

    # 3. Query Income Statement Matrix (Consolidated, Annual)
    is_resp = client.get(
        f"/api/v1/companies/{comp.id}/statements?statement_type=INCOME_STATEMENT&reporting_basis=CONSOLIDATED&period_type=ANNUAL"
    )
    assert is_resp.status_code == 200
    is_matrix = is_resp.json()

    assert is_matrix["company_id"] == comp.id
    assert is_matrix["company_name"] == "Tata Power Company Ltd"
    assert is_matrix["isin"] == "INE245A01021"
    assert len(is_matrix["periods"]) == 3
    assert [p["display_label"] for p in is_matrix["periods"]] == ["FY2022", "FY2023", "FY2024"]

    # Verify rows exist and values are present
    row_codes = [r["metric_code"] for r in is_matrix["rows"]]
    assert "REVENUE" in row_codes
    assert "EBITDA" in row_codes
    assert "PAT" in row_codes
    assert "EPS" in row_codes

    rev_row = next(r for r in is_matrix["rows"] if r["metric_code"] == "REVENUE")
    assert rev_row["values"]["FY2022"] is not None
    assert rev_row["values"]["FY2023"] is not None
    assert rev_row["values"]["FY2024"] is not None
    # Growth verification
    assert float(rev_row["values"]["FY2024"]) > float(rev_row["values"]["FY2022"])

    # Verify provenance detail inside the row
    fy24_detail = rev_row["details"]["FY2024"]
    assert fy24_detail is not None
    assert fy24_detail["metric_code"] == "REVENUE"
    assert fy24_detail["unit"] == "CRORES"
    assert "Cr" in fy24_detail["formatted_value"]

    # 4. Query Balance Sheet Matrix
    bs_resp = client.get(
        f"/api/v1/companies/{comp.id}/statements?statement_type=BALANCE_SHEET&reporting_basis=CONSOLIDATED&period_type=ANNUAL"
    )
    assert bs_resp.status_code == 200
    bs_matrix = bs_resp.json()
    bs_codes = [r["metric_code"] for r in bs_matrix["rows"]]
    assert "TOTAL_ASSETS" in bs_codes
    assert "TOTAL_LIABILITIES" in bs_codes
    assert "TOTAL_EQUITY" in bs_codes


def test_reporting_basis_and_period_isolation(db_session: Session, client: TestClient):
    """Test that standalone vs consolidated and annual vs quarterly statements remain strictly isolated."""
    ex = Exchange(code="NSE", name="National Stock Exchange")
    db_session.add(ex)
    db_session.flush()

    comp = Company(name="Isolation Test Ltd", isin="INE888B01088", is_financial_sector=False)
    db_session.add(comp)
    db_session.flush()

    # Query without any data
    empty_resp = client.get(
        f"/api/v1/companies/{comp.id}/statements?statement_type=INCOME_STATEMENT&reporting_basis=CONSOLIDATED&period_type=ANNUAL"
    )
    assert empty_resp.status_code == 200
    empty_data = empty_resp.json()
    assert len(empty_data["periods"]) == 0
    assert len(empty_data["rows"]) == 0

    # Query available periods
    avail_resp = client.get(f"/api/v1/companies/{comp.id}/available-statement-periods")
    assert avail_resp.status_code == 200
    avail_data = avail_resp.json()
    assert avail_data["has_consolidated"] is False
    assert avail_data["has_standalone"] is False


def test_corporate_actions_and_shareholding_endpoints(db_session: Session, client: TestClient):
    """Test querying corporate actions and quarterly shareholding distributions."""
    ex = Exchange(code="NSE", name="National Stock Exchange")
    db_session.add(ex)
    db_session.flush()

    comp = Company(name="Hindustan Lever Ltd", isin="INE030A01027", is_financial_sector=False)
    db_session.add(comp)
    db_session.flush()

    # Seed
    client.post(f"/api/v1/companies/{comp.id}/seed-financials")

    # 1. Corporate Actions
    ca_resp = client.get(f"/api/v1/companies/{comp.id}/corporate-actions")
    assert ca_resp.status_code == 200
    ca_list = ca_resp.json()
    assert len(ca_list) >= 2
    action_types = [a["action_type"] for a in ca_list]
    assert "DIVIDEND" in action_types

    # 2. Shareholding Pattern
    sh_resp = client.get(f"/api/v1/companies/{comp.id}/shareholding")
    assert sh_resp.status_code == 200
    sh_list = sh_resp.json()
    assert len(sh_list) == 4  # 4 quarters
    latest = sh_list[0]
    assert float(latest["promoter_pct"]) > 0
    assert float(latest["fii_pct"]) > 0
    assert float(latest["dii_pct"]) > 0
    assert float(latest["public_pct"]) > 0
    # Percentages add up to ~100%
    total_pct = (
        float(latest["promoter_pct"])
        + float(latest["fii_pct"])
        + float(latest["dii_pct"])
        + float(latest["public_pct"])
    )
    assert 99.0 <= total_pct <= 101.0


def test_source_document_library_and_download(db_session: Session, client: TestClient):
    """Test uploaded documents listing and download endpoints."""
    ex = Exchange(code="NSE", name="National Stock Exchange")
    db_session.add(ex)
    db_session.flush()

    comp = Company(name="Document Test Equities Ltd", isin="INE777C01077", is_financial_sector=False)
    db_session.add(comp)
    db_session.flush()

    # 1. Upload a sample Annual Report PDF
    pdf_bytes = b"%PDF-1.4 Mock Annual Report content with audited financial tables"
    files = {"file": ("Annual_Report_FY24.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {
        "company_id": comp.id,
        "fiscal_year": 2024,
        "fiscal_period": "FY",
        "document_type": "ANNUAL_REPORT",
    }
    upload_resp = client.post("/api/v1/ingestion/upload/report", files=files, data=data)
    assert upload_resp.status_code == 200
    doc_info = upload_resp.json()
    doc_id = doc_info["id"]
    assert doc_id > 0
    assert doc_info["file_name"] == "Annual_Report_FY24.pdf"

    # 2. List documents via GET /api/v1/ingestion/documents
    docs_resp = client.get("/api/v1/ingestion/documents")
    assert docs_resp.status_code == 200
    docs_list = docs_resp.json()
    assert docs_list["total"] >= 1
    doc_item = next(d for d in docs_list["items"] if d["id"] == doc_id)
    assert doc_item["file_name"] == "Annual_Report_FY24.pdf"
    assert doc_item["company_id"] == comp.id
    assert doc_item["company_name"] == "Document Test Equities Ltd"
    assert doc_item["fiscal_year"] == 2024

    # 3. Filter documents by company_id
    filtered_resp = client.get(f"/api/v1/ingestion/documents?company_id={comp.id}")
    assert filtered_resp.status_code == 200
    filtered_list = filtered_resp.json()
    assert filtered_list["total"] == 1
    assert filtered_list["items"][0]["id"] == doc_id

    # 4. Download document via GET /api/v1/ingestion/documents/{id}/download
    download_resp = client.get(f"/api/v1/ingestion/documents/{doc_id}/download")
    assert download_resp.status_code == 200
    assert download_resp.content == pdf_bytes
    assert "pdf" in download_resp.headers["content-type"].lower()
