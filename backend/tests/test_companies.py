"""Tests for Company Master, ISIN deduplication, NSE/BSE security mapping, and search."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.schemas.company import CompanyCreate, SecurityCreate
from app.services.company_service import CompanyService


def test_isin_cross_exchange_deduplication(db_session: Session):
    """Verify that multiple exchange listings (NSE and BSE) map into a single canonical company."""
    service = CompanyService(db_session)

    # 1. Ingest Reliance via NSE
    nse_payload = CompanyCreate(
        name="Reliance Industries Limited",
        isin="INE002A01018",
        sector_name="Energy",
        industry_name="Refineries",
        securities=[
            SecurityCreate(
                exchange_code="NSE",
                symbol="RELIANCE",
                is_primary=True,
            )
        ],
    )
    company_1 = service.upsert_company(nse_payload)
    assert company_1.id is not None
    assert company_1.isin == "INE002A01018"
    assert len(company_1.securities) == 1
    assert company_1.securities[0].exchange_code == "NSE"
    assert company_1.securities[0].symbol == "RELIANCE"

    # 2. Ingest Reliance via BSE with identical ISIN
    bse_payload = CompanyCreate(
        name="Reliance Industries Ltd",
        isin="INE002A01018",
        sector_name="Energy",
        industry_name="Refineries",
        securities=[
            SecurityCreate(
                exchange_code="BSE",
                symbol="500325",
                is_primary=False,
            )
        ],
    )
    company_2 = service.upsert_company(bse_payload)

    # Must be the exact same canonical company
    assert company_2.id == company_1.id
    assert company_2.isin == "INE002A01018"
    # Must now possess both NSE and BSE securities
    assert len(company_2.securities) == 2
    exchange_codes = {s.exchange_code for s in company_2.securities}
    symbols = {s.symbol for s in company_2.securities}
    assert exchange_codes == {"NSE", "BSE"}
    assert symbols == {"RELIANCE", "500325"}


def test_search_by_name_symbol_and_isin(db_session: Session):
    """Verify search finds companies by partial name, NSE symbol, BSE symbol, or ISIN."""
    service = CompanyService(db_session)
    service.seed_initial_universe_if_empty()

    # Search by partial company name
    res_name = service.search_companies(query="reliance")
    assert res_name.total >= 1
    assert any("RELIANCE" in item.name.upper() for item in res_name.items)

    # Search by NSE trading symbol
    res_nse = service.search_companies(query="TCS")
    assert res_nse.total >= 1
    assert any(item.isin == "INE467B01029" for item in res_nse.items)

    # Search by BSE scrip code (symbol)
    res_bse = service.search_companies(query="500180")
    assert res_bse.total >= 1
    assert any(item.isin == "INE040A01034" for item in res_bse.items)  # HDFC Bank

    # Search by exact ISIN
    res_isin = service.search_companies(query="INE155A01022")
    assert res_isin.total == 1
    assert res_isin.items[0].primary_symbol == "TATAMOTORS"


def test_financial_sector_flag(db_session: Session):
    """Verify banking and financial companies carry is_financial_sector=True."""
    service = CompanyService(db_session)
    service.seed_initial_universe_if_empty()

    hdfc = service.get_company_by_isin("INE040A01034")
    assert hdfc is not None
    assert hdfc.is_financial_sector is True

    tcs = service.get_company_by_isin("INE467B01029")
    assert tcs is not None
    assert tcs.is_financial_sector is False


def test_company_api_endpoints(client: TestClient):
    """Verify HTTP API v1 endpoints for companies and search."""
    # Seed universe via API
    seed_res = client.post("/api/v1/companies/seed")
    assert seed_res.status_code == 201
    assert seed_res.json()["status"] == "success"

    # Search companies
    search_res = client.get("/api/v1/companies?q=reliance")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] >= 1
    company_item = search_data["items"][0]
    assert company_item["isin"] == "INE002A01018"
    assert "NSE" in company_item["exchange_listings"]
    assert "BSE" in company_item["exchange_listings"]

    # Get by ID
    comp_id = company_item["id"]
    detail_res = client.get(f"/api/v1/companies/{comp_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["name"] == "Reliance Industries Limited"
    assert len(detail["securities"]) == 2

    # Get by ISIN
    isin_res = client.get(f"/api/v1/companies/isin/{company_item['isin']}")
    assert isin_res.status_code == 200
    assert isin_res.json()["id"] == comp_id

    # List sectors
    sector_res = client.get("/api/v1/companies/taxonomy/sectors")
    assert sector_res.status_code == 200
    assert len(sector_res.json()) >= 1


def test_auto_sector_resolution_on_import(db_session: Session):
    """Verify that importing or resolving a company automatically populates sector and industry taxonomy."""
    service = CompanyService(db_session)

    # 1. Test sector auto-resolution for Technology
    sec_tech, ind_tech, is_fin_tech = service._resolve_sector_and_industry(
        "INFY", "NSE", "Infosys Limited"
    )
    assert sec_tech == "Technology"
    assert "Technology" in ind_tech or "IT" in ind_tech
    assert is_fin_tech is False

    # 2. Test sector auto-resolution for Financials / Banks
    sec_bank, ind_bank, is_fin_bank = service._resolve_sector_and_industry(
        "SBIN", "NSE", "State Bank of India"
    )
    assert sec_bank == "Financials"
    assert "Bank" in ind_bank or "Financial" in ind_bank
    assert is_fin_bank is True

    # 3. Test sector auto-resolution for Pharma
    sec_pharma, ind_pharma, is_fin_pharma = service._resolve_sector_and_industry(
        "SUNPHARMA", "NSE", "Sun Pharmaceutical Industries Limited"
    )
    assert sec_pharma == "Healthcare & Pharmaceuticals"
    assert is_fin_pharma is False

    # 4. Verify that when a company is added to DB, its sector and industry are populated
    comp_create = CompanyCreate(
        name="Infosys Limited",
        isin="INE009A01021",
        sector_name=sec_tech,
        industry_name=ind_tech,
        is_financial_sector=is_fin_tech,
        securities=[
            SecurityCreate(
                exchange_code="NSE",
                symbol="INFY",
                is_primary=True,
            )
        ],
    )
    company = service.upsert_company(comp_create)
    assert company.sector is not None
    assert company.sector.name == "Technology"
    assert company.industry is not None
    assert company.is_financial_sector is False
