"""Integration tests for Portfolio API endpoints and workflows."""

from datetime import date
from decimal import Decimal
import io
import uuid
import pytest

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.main import app
from app.models.company import Company, Exchange, Security
from app.models.portfolio import Portfolio, Transaction

client = TestClient(app)


@pytest.fixture
def portfolio_test_company():
    """Create or fetch a test company and security for portfolio tests."""
    with SessionLocal() as db:
        company = db.query(Company).filter(Company.cin == "L14141MH2022PLC141414").first()
        if not company:
            company = Company(
                name="Portfolio Test Corp Ltd",
                legal_name="Portfolio Test Corporation Limited",
                isin="INE141P01014",
                cin="L14141MH2022PLC141414",
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

        sec = db.query(Security).filter(Security.company_id == company.id, Security.symbol == "PORTFOLIO").first()
        if not sec:
            sec = Security(
                company_id=company.id,
                exchange_id=exchange.id,
                symbol="PORTFOLIO",
                series="EQ",
                is_primary=True,
                market_cap_category="LARGE_CAP",
            )
            db.add(sec)
            db.commit()
            db.refresh(sec)

        return company, sec


def test_portfolio_crud_and_transaction_flow(portfolio_test_company):
    company, sec = portfolio_test_company
    symbol = sec.symbol

    unique_name = f"Test Portfolio {uuid.uuid4().hex[:8]}"
    # 1. Create a portfolio
    create_res = client.post(
        "/api/v1/portfolios",
        json={
            "name": unique_name,
            "description": "Long-term test equity portfolio",
            "benchmark_symbol": "^NSEI",
            "cash_balance": 100000.0,
        },
    )
    assert create_res.status_code == 201
    portfolio_data = create_res.json()
    p_id = portfolio_data["id"]
    assert portfolio_data["name"] == unique_name
    assert portfolio_data["cash_balance"] == 100000.0

    # 2. Log a BUY transaction
    buy_res = client.post(
        f"/api/v1/portfolios/{p_id}/transactions",
        json={
            "symbol": symbol,
            "transaction_type": "BUY",
            "trade_date": "2024-01-15",
            "quantity": 50.0,
            "price_per_share": 2000.0,
            "brokerage_charges": 20.0,
            "taxes": 15.0,
            "notes": "Initial batch purchase",
        },
    )
    assert buy_res.status_code == 201
    buy_data = buy_res.json()
    assert buy_data["transaction_type"] == "BUY"
    assert buy_data["quantity"] == 50.0

    # 3. Log a Section 55 BONUS issue (1:1 bonus, 50 shares at ₹0 cost)
    bonus_res = client.post(
        f"/api/v1/portfolios/{p_id}/transactions",
        json={
            "symbol": symbol,
            "transaction_type": "BONUS",
            "trade_date": "2024-06-01",
            "quantity": 50.0,
            "price_per_share": 0.0,
            "notes": "1:1 Bonus Issue",
        },
    )
    assert bonus_res.status_code == 201

    # 4. Log a SELL transaction (sell 60 shares: 50 from original @ 2000, 10 from bonus @ 0)
    sell_res = client.post(
        f"/api/v1/portfolios/{p_id}/transactions",
        json={
            "symbol": symbol,
            "transaction_type": "SELL",
            "trade_date": "2024-09-01",
            "quantity": 60.0,
            "price_per_share": 2500.0,
            "brokerage_charges": 20.0,
            "taxes": 20.0,
            "notes": "Partial profit taking",
        },
    )
    assert sell_res.status_code == 201

    # 5. Fetch transactions list
    txns_res = client.get(f"/api/v1/portfolios/{p_id}/transactions")
    assert txns_res.status_code == 200
    txns = txns_res.json()
    assert len(txns) == 3

    # 6. Fetch portfolio analytics
    analytics_res = client.get(f"/api/v1/portfolios/{p_id}/analytics")
    assert analytics_res.status_code == 200
    analytics = analytics_res.json()
    assert analytics["portfolio_name"] == unique_name
    assert len(analytics["holdings"]) == 1
    holding = analytics["holdings"][0]
    # Remaining: 40 bonus shares
    assert holding["total_quantity"] == 40.0
    assert holding["average_buy_price"] == 0.0  # Remaining shares are bonus shares with 0 cost
    assert holding["realized_pnl"] > 0.0  # Positive profit realized

    # 7. Import CSV (test idempotency and tradebook import)
    csv_data = f"""symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,order_id,trade_id
{symbol},INE141P01014,2024-10-01,NSE,EQ,EQ,BUY,10,2200,1001,KITE-TRD-1001
{symbol},INE141P01014,2024-10-01,NSE,EQ,EQ,BUY,10,2200,1001,KITE-TRD-1001
"""
    csv_file = io.BytesIO(csv_data.encode("utf-8"))
    import_res = client.post(
        f"/api/v1/portfolios/{p_id}/import-csv",
        files={"file": ("tradebook.csv", csv_file, "text/csv")},
    )
    assert import_res.status_code == 200
    import_data = import_res.json()
    assert import_data["imported_count"] == 1  # 1 imported
    assert import_data["skipped_count"] == 1   # 1 duplicate skipped!

    # 8. Clean up / Delete portfolio
    del_res = client.delete(f"/api/v1/portfolios/{p_id}")
    assert del_res.status_code == 204
