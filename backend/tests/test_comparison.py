"""Unit and integration tests for Phase 11: Competitor Analysis & Peer Comparison."""

import csv
import io

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.company import Company, Exchange, Industry, Sector, Security
from app.services.comparison_service import ComparisonService


def _setup_comparison_companies(db: Session) -> tuple[Company, Company, Company]:
    """Helper to ensure at least 2 industrial and 1 banking company exist for comparison testing."""
    tech_sector = db.query(Sector).filter_by(code="TECH").first()
    if not tech_sector:
        tech_sector = Sector(name="Technology", code="TECH")
        db.add(tech_sector)
        db.flush()

    fin_sector = db.query(Sector).filter_by(code="FIN").first()
    if not fin_sector:
        fin_sector = Sector(name="Financials", code="FIN")
        db.add(fin_sector)
        db.flush()

    it_ind = db.query(Industry).filter_by(name="IT Services").first()
    if not it_ind:
        it_ind = Industry(name="IT Services", sector_id=tech_sector.id)
        db.add(it_ind)
        db.flush()

    bank_ind = db.query(Industry).filter_by(name="Commercial Banking").first()
    if not bank_ind:
        bank_ind = Industry(name="Commercial Banking", sector_id=fin_sector.id)
        db.add(bank_ind)
        db.flush()

    exchange = db.query(Exchange).filter_by(code="NSE").first()
    if not exchange:
        exchange = Exchange(code="NSE", name="NSE", currency="INR")
        db.add(exchange)
        db.flush()

    # Company 1: Industrial / Tech
    c1 = db.query(Company).filter_by(isin="INE000COMP01").first()
    if not c1:
        c1 = Company(
            name="Alpha Tech Ltd",
            isin="INE000COMP01",
            sector_id=tech_sector.id,
            industry_id=it_ind.id,
            is_financial_sector=False,
        )
        db.add(c1)
        db.flush()
        db.add(Security(company_id=c1.id, exchange_id=exchange.id, symbol="ALPHATECH", is_primary=True))

    # Company 2: Industrial / Tech Peer
    c2 = db.query(Company).filter_by(isin="INE000COMP02").first()
    if not c2:
        c2 = Company(
            name="Beta Software Ltd",
            isin="INE000COMP02",
            sector_id=tech_sector.id,
            industry_id=it_ind.id,
            is_financial_sector=False,
        )
        db.add(c2)
        db.flush()
        db.add(Security(company_id=c2.id, exchange_id=exchange.id, symbol="BETASOFT", is_primary=True))

    # Company 3: Bank
    c3 = db.query(Company).filter_by(isin="INE000BANK01").first()
    if not c3:
        c3 = Company(
            name="Delta Bank Ltd",
            isin="INE000BANK01",
            sector_id=fin_sector.id,
            industry_id=bank_ind.id,
            is_financial_sector=True,
        )
        db.add(c3)
        db.flush()
        db.add(Security(company_id=c3.id, exchange_id=exchange.id, symbol="DELTABANK", is_primary=True))

    db.commit()
    return c1, c2, c3


def test_get_company_peers(db_session: Session):
    """Verify sector peer discovery excludes self and returns valid peer summaries."""
    c1, c2, _ = _setup_comparison_companies(db_session)
    svc = ComparisonService(db_session)

    res = svc.get_company_peers(c1.id)
    assert res.company_id == c1.id
    assert res.company_name == c1.name
    assert res.peers_count >= 1

    # c2 must be in peers list; c1 must NOT be in peers list
    peer_ids = [p.id for p in res.peers]
    assert c1.id not in peer_ids
    assert c2.id in peer_ids


def test_compare_companies_matrix_and_leaders(db_session: Session):
    """Verify comparison matrix generation, metric row categorization, and leader attribution."""
    c1, c2, _ = _setup_comparison_companies(db_session)
    svc = ComparisonService(db_session)

    resp = svc.compare_companies([c1.id, c2.id], reporting_basis="CONSOLIDATED")
    assert resp.companies_count == 2
    assert len(resp.companies) == 2
    assert "Valuation & Market" in resp.categories
    assert "Profitability & Returns" in resp.categories
    assert "Solvency & Capital Structure" in resp.categories

    # Verify metric rows are present
    metric_keys = [m.metric_key for m in resp.metrics]
    assert "market_cap" in metric_keys
    assert "pe_ratio" in metric_keys
    assert "roce" in metric_keys
    assert "debt_to_equity" in metric_keys

    # Check radar scores
    assert len(resp.radar_scores) == 2
    for r in resp.radar_scores:
        assert 0.0 <= r.growth <= 100.0
        assert 0.0 <= r.profitability <= 100.0
        assert 0.0 <= r.financial_health <= 100.0


def test_banking_sector_isolation_in_comparison(db_session: Session):
    """Verify that comparing an industrial company with a bank properly isolates solvency and banking metrics."""
    c1, _, c_bank = _setup_comparison_companies(db_session)
    svc = ComparisonService(db_session)

    resp = svc.compare_companies([c1.id, c_bank.id], reporting_basis="CONSOLIDATED")

    # Find Debt to Equity row (industrial only)
    de_row = next(m for m in resp.metrics if m.metric_key == "debt_to_equity")
    assert de_row.is_industrial_only is True
    # Bank should have BANKING_BYPASS
    assert de_row.values[c_bank.id].bypass_reason == "BANKING_BYPASS"
    assert de_row.values[c_bank.id].raw_value is None

    # Find Net Interest Margin row (banking only)
    nim_row = next(m for m in resp.metrics if m.metric_key == "nim")
    assert nim_row.is_banking_only is True
    # Industrial should have NON_FINANCIAL_BYPASS
    assert nim_row.values[c1.id].bypass_reason == "NON_FINANCIAL_BYPASS"
    assert nim_row.values[c1.id].raw_value is None


def test_export_comparison_csv(db_session: Session):
    """Verify RFC 4180 CSV export contains proper headers, metric rows, and company columns."""
    c1, c2, _ = _setup_comparison_companies(db_session)
    svc = ComparisonService(db_session)

    csv_text = svc.export_comparison_csv([c1.id, c2.id], reporting_basis="CONSOLIDATED")
    assert "Category,Metric,Unit,Peer Average" in csv_text
    assert c1.name in csv_text
    assert c2.name in csv_text

    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    assert len(rows) > 10
    header = rows[0]
    assert header[0] == "Category"
    assert header[1] == "Metric"


def test_comparison_api_endpoints(client: TestClient, db_session: Session):
    """Verify POST /compare, GET /compare, and POST /compare/export-csv endpoints."""
    c1, c2, _ = _setup_comparison_companies(db_session)

    # 1. POST /api/v1/companies/compare
    post_resp = client.post(
        "/api/v1/companies/compare",
        json={"company_ids": [c1.id, c2.id], "reporting_basis": "CONSOLIDATED"},
    )
    assert post_resp.status_code == 200
    data = post_resp.json()
    assert data["companies_count"] == 2
    assert len(data["metrics"]) > 0

    # 2. GET /api/v1/companies/compare?ids=...
    get_resp = client.get(f"/api/v1/companies/compare?ids={c1.id},{c2.id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["companies_count"] == 2

    # 3. POST /api/v1/companies/compare/export-csv
    csv_resp = client.post(
        "/api/v1/companies/compare/export-csv",
        json={"company_ids": [c1.id, c2.id], "reporting_basis": "CONSOLIDATED"},
    )
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "competitor_comparison.csv" in csv_resp.headers["content-disposition"]

    # 4. GET /api/v1/companies/{id}/peers
    peers_resp = client.get(f"/api/v1/companies/{c1.id}/peers")
    assert peers_resp.status_code == 200
    p_data = peers_resp.json()
    assert p_data["company_id"] == c1.id
    assert "peers" in p_data

    # 5. Invalid input error handling
    bad_resp = client.post("/api/v1/companies/compare", json={"company_ids": []})
    assert bad_resp.status_code == 400
