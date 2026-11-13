"""Unit and integration tests for Phase 13: Watchlists and Investment Journal."""

import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.company import Company, Exchange, Security
from app.models.workflow import InvestmentNote


@pytest.fixture
def workflow_test_company():
    """Create or fetch a test company for watchlist and journal tests."""
    with SessionLocal() as db:
        company = db.query(Company).filter(Company.cin == "L13131MH2021PLC131313").first()
        if not company:
            company = Company(
                name="Workflow Test Corp Ltd",
                legal_name="Workflow Test Corporation Limited",
                isin="INE131W01013",
                cin="L13131MH2021PLC131313",
                is_financial_sector=False,
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        exchange = db.query(Exchange).first()
        if not exchange:
            exchange = Exchange(code="NSE", name="National Stock Exchange", country="India")
            db.add(exchange)
            db.commit()
            db.refresh(exchange)

        sec = db.query(Security).filter(Security.company_id == company.id, Security.symbol == "WORKFLOW").first()
        if not sec:
            sec = Security(
                company_id=company.id,
                exchange_id=exchange.id,
                symbol="WORKFLOW",
                series="EQ",
                is_primary=True,
            )
            db.add(sec)
            db.commit()

        yield company


# ─── 1. Watchlist Tests ──────────────────────────────────────────────────────


def test_watchlist_crud_lifecycle(workflow_test_company):
    client = TestClient(app)

    # 1. Create Watchlist
    create_payload = {
        "name": "High Conviction Growth 2027",
        "description": "Long-term compounders with high ROCE",
        "color": "#00d992",
    }
    res = client.post("/api/v1/watchlists", json=create_payload)
    assert res.status_code == 201
    wl_data = res.json()
    wl_id = wl_data["id"]
    assert wl_data["name"] == "High Conviction Growth 2027"
    assert wl_data["items_count"] == 0

    # 2. Add Item to Watchlist
    item_payload = {
        "company_id": workflow_test_company.id,
        "target_entry_price": 450.0,
        "target_exit_price": 750.0,
        "conviction": 5,
        "thesis_summary": "Dominant market leader with 25% ROCE and structural tailwinds",
        "notes": "Look to accumulate under ₹450",
    }
    item_res = client.post(f"/api/v1/watchlists/{wl_id}/items", json=item_payload)
    assert item_res.status_code == 201
    item_data = item_res.json()
    item_id = item_data["id"]
    assert item_data["symbol"] == "WORKFLOW"
    assert item_data["conviction"] == 5
    assert item_data["target_entry_price"] == 450.0

    # 3. Duplicate Prevention Guard
    dup_res = client.post(f"/api/v1/watchlists/{wl_id}/items", json=item_payload)
    assert dup_res.status_code == 400
    assert "already in watchlist" in dup_res.json()["detail"]

    # 4. Update Item
    update_item_payload = {
        "target_entry_price": 480.0,
        "conviction": 4,
    }
    up_res = client.put(f"/api/v1/watchlists/{wl_id}/items/{item_id}", json=update_item_payload)
    assert up_res.status_code == 200
    assert up_res.json()["target_entry_price"] == 480.0
    assert up_res.json()["conviction"] == 4

    # 5. List Watchlists
    list_res = client.get("/api/v1/watchlists")
    assert list_res.status_code == 200
    lists = list_res.json()
    matched_wl = next((w for w in lists if w["id"] == wl_id), None)
    assert matched_wl is not None
    assert matched_wl["items_count"] == 1
    assert len(matched_wl["items"]) == 1

    # 6. Remove Item
    del_item_res = client.delete(f"/api/v1/watchlists/{wl_id}/items/{item_id}")
    assert del_item_res.status_code == 204

    # Verify item removed
    get_wl_res = client.get(f"/api/v1/watchlists/{wl_id}")
    assert get_wl_res.status_code == 200
    assert get_wl_res.json()["items_count"] == 0

    # 7. Delete Watchlist
    del_wl_res = client.delete(f"/api/v1/watchlists/{wl_id}")
    assert del_wl_res.status_code == 204


# ─── 2. Investment Journal Tests ─────────────────────────────────────────────


def test_investment_journal_crud_lifecycle(workflow_test_company):
    client = TestClient(app)

    # 1. Create Journal Note
    note_payload = {
        "company_id": workflow_test_company.id,
        "title": "Initial Thesis: Capex cycle inflection & margin expansion",
        "category": "THESIS",
        "conviction_score": 4,
        "content": "## Core Investment Thesis\n\n1. Company is doubling manufacturing capacity by Q3.\n2. Operating leverage will expand margins from 18% to 23%.\n3. Debt repayment ahead of schedule.",
        "catalysts": [
            {"title": "New plant commissioning", "target_date": "2027-03-31", "status": "PENDING", "impact": "HIGH"},
            {"title": "Q3 Results margin print", "target_date": "2027-01-20", "status": "PENDING", "impact": "MEDIUM"},
        ],
        "key_risks": [
            {"title": "Raw material inflation in copper", "severity": "MEDIUM", "mitigant": "Pass-through contracts"},
        ],
        "target_price": 650.0,
    }
    create_res = client.post("/api/v1/journal", json=note_payload)
    assert create_res.status_code == 201
    note_data = create_res.json()
    note_id = note_data["id"]
    assert note_data["title"] == note_payload["title"]
    assert note_data["category"] == "THESIS"
    assert note_data["conviction_score"] == 4
    assert len(note_data["catalysts"]) == 2
    assert len(note_data["key_risks"]) == 1
    assert note_data["symbol"] == "WORKFLOW"

    # 2. Get Single Note
    get_res = client.get(f"/api/v1/journal/{note_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == note_id

    # 3. List Notes with Filter
    list_res = client.get(f"/api/v1/journal?company_id={workflow_test_company.id}&category=THESIS")
    assert list_res.status_code == 200
    notes = list_res.json()
    assert any(n["id"] == note_id for n in notes)

    # Filter by higher conviction than 4 should exclude it
    high_conv_res = client.get("/api/v1/journal?min_conviction=5")
    assert high_conv_res.status_code == 200
    assert not any(n["id"] == note_id for n in high_conv_res.json())

    # 4. Update Note
    update_payload = {
        "title": "Updated Thesis: Capex commissioned early",
        "conviction_score": 5,
    }
    up_res = client.put(f"/api/v1/journal/{note_id}", json=update_payload)
    assert up_res.status_code == 200
    assert up_res.json()["title"] == "Updated Thesis: Capex commissioned early"
    assert up_res.json()["conviction_score"] == 5

    # 5. Delete Note
    del_res = client.delete(f"/api/v1/journal/{note_id}")
    assert del_res.status_code == 204

    # Verify deleted
    with SessionLocal() as db:
        assert db.get(InvestmentNote, note_id) is None
