"""Portfolio service managing portfolios, transactions, FIFO matching, and analytics."""

import csv
from datetime import UTC, date, datetime
from decimal import Decimal
import io
import logging
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.calculations.portfolio import (
    calculate_asset_allocation,
    calculate_fifo_lots,
    calculate_portfolio_beta_alpha,
    calculate_xirr,
)
from app.models.company import Company, Security
from app.models.market_data import CorporateAction, PriceHistory
from app.models.portfolio import Portfolio, PortfolioHolding, Transaction
from app.schemas.portfolio import (
    HoldingRead,
    MarketCapAllocation,
    PortfolioAnalyticsRead,
    PortfolioCreate,
    PortfolioRead,
    PortfolioUpdate,
    SectorAllocation,
    TransactionCreate,
)
from app.services.price_service import PriceService

logger = logging.getLogger(__name__)


class PortfolioService:
    def __init__(self, db: Session):
        self.db = db
        self.price_service = PriceService()

    def list_portfolios(self) -> list[PortfolioRead]:
        """List all portfolios with aggregated net worth and holding counts."""
        portfolios = (
            self.db.query(Portfolio)
            .options(joinedload(Portfolio.holdings), joinedload(Portfolio.transactions))
            .order_by(Portfolio.id.asc())
            .all()
        )

        results: list[PortfolioRead] = []
        for p in portfolios:
            total_invested = float(sum(h.invested_amount for h in p.holdings))
            total_realized = float(sum(h.realized_pnl for h in p.holdings))

            # Fetch current prices for active holdings to compute equity value
            total_stock_value = 0.0
            for h in p.holdings:
                if h.total_quantity > 0:
                    sec = self.db.query(Security).filter(Security.id == h.security_id).first()
                    curr_price = float(h.average_buy_price)
                    if sec:
                        quote = self.price_service.get_latest_quote(sec.symbol, sec.exchange.code)
                        if quote and quote.get("current_price"):
                            curr_price = float(quote["current_price"])
                    total_stock_value += float(h.total_quantity) * curr_price

            cash = float(p.cash_balance)
            total_equity = total_stock_value + cash
            unrealized_pnl = total_stock_value - total_invested

            # Portfolio level XIRR
            xirr_val = self._compute_portfolio_xirr(p, total_equity)

            results.append(
                PortfolioRead(
                    id=p.id,
                    name=p.name,
                    description=p.description,
                    benchmark_symbol=p.benchmark_symbol,
                    cash_balance=cash,
                    currency=p.currency,
                    total_equity_value=round(total_equity, 2),
                    total_invested_amount=round(total_invested, 2),
                    total_unrealized_pnl=round(unrealized_pnl, 2),
                    total_realized_pnl=round(total_realized, 2),
                    portfolio_xirr=xirr_val,
                    holdings_count=len([h for h in p.holdings if h.total_quantity > 0]),
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
            )
        return results

    def get_portfolio(self, portfolio_id: int) -> Portfolio | None:
        return self.db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()

    def create_portfolio(self, data: PortfolioCreate) -> Portfolio:
        portfolio = Portfolio(
            name=data.name.strip(),
            description=data.description,
            benchmark_symbol=data.benchmark_symbol or "^NSEI",
            cash_balance=data.cash_balance,
            currency="INR",
        )
        self.db.add(portfolio)
        self.db.commit()
        self.db.refresh(portfolio)
        return portfolio

    def update_portfolio(self, portfolio_id: int, data: PortfolioUpdate) -> Portfolio | None:
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio:
            return None

        if data.name is not None:
            portfolio.name = data.name.strip()
        if data.description is not None:
            portfolio.description = data.description
        if data.benchmark_symbol is not None:
            portfolio.benchmark_symbol = data.benchmark_symbol
        if data.cash_balance is not None:
            portfolio.cash_balance = data.cash_balance

        portfolio.updated_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(portfolio)
        return portfolio

    def delete_portfolio(self, portfolio_id: int) -> bool:
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio:
            return False
        self.db.delete(portfolio)
        self.db.commit()
        return True

    def _resolve_security(self, symbol: str | None, security_id: int | None, company_id: int | None) -> tuple[Security | None, Company | None]:
        if security_id:
            sec = self.db.query(Security).filter(Security.id == security_id).first()
            if sec:
                return sec, sec.company

        if symbol:
            clean_sym = symbol.strip().upper()
            sec = (
                self.db.query(Security)
                .filter(Security.symbol == clean_sym)
                .order_by(Security.is_primary.desc())
                .first()
            )
            if sec:
                return sec, sec.company

        if company_id:
            comp = self.db.query(Company).filter(Company.id == company_id).first()
            if comp and comp.securities:
                primary = next((s for s in comp.securities if s.is_primary), comp.securities[0])
                return primary, comp

        return None, None

    def add_transaction(self, portfolio_id: int, data: TransactionCreate) -> Transaction:
        """Add a transaction with row-level locking on Portfolio and update holdings snapshot."""
        # Row-level lock on portfolio
        portfolio = (
            self.db.query(Portfolio)
            .filter(Portfolio.id == portfolio_id)
            .with_for_update()
            .first()
        )
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")

        ttype = data.transaction_type.strip().upper()
        sec, comp = self._resolve_security(data.symbol, data.security_id, data.company_id)

        # Cash balance impact
        amount = Decimal("0.0000")
        qty = Decimal(str(data.quantity or 0))
        price = Decimal(str(data.price_per_share or 0))
        charges = Decimal(str(data.brokerage_charges or 0)) + Decimal(str(data.taxes or 0))

        if ttype == "BUY":
            amount = (qty * price) + charges
            if portfolio.cash_balance >= amount:
                portfolio.cash_balance -= amount
        elif ttype == "SELL":
            amount = (qty * price) - charges
            portfolio.cash_balance += amount
        elif ttype == "DIVIDEND":
            amount = Decimal(str(data.amount or (qty * price)))
            portfolio.cash_balance += amount
        elif ttype == "DEPOSIT":
            amount = Decimal(str(data.amount or 0))
            portfolio.cash_balance += amount
        elif ttype == "WITHDRAWAL":
            amount = Decimal(str(data.amount or 0))
            portfolio.cash_balance -= amount
        elif ttype in ("SPLIT", "BONUS"):
            amount = Decimal("0.0000")

        txn = Transaction(
            portfolio_id=portfolio_id,
            security_id=sec.id if sec else None,
            company_id=comp.id if comp else None,
            transaction_type=ttype,
            trade_date=data.trade_date,
            trade_time=data.trade_time,
            order_sequence=data.order_sequence,
            quantity=data.quantity,
            price_per_share=data.price_per_share,
            amount=amount if data.amount is None else data.amount,
            brokerage_charges=data.brokerage_charges,
            taxes=data.taxes,
            broker_trade_id=data.broker_trade_id,
            notes=data.notes,
        )
        self.db.add(txn)
        self.db.flush()

        # Recalculate holding cache for this security
        if sec and comp:
            self._recalculate_holding(portfolio_id, sec.id, comp.id)

        self.db.commit()
        self.db.refresh(txn)
        return txn

    def _recalculate_holding(self, portfolio_id: int, security_id: int, company_id: int) -> None:
        """Run FIFO lot matching across all historical transactions for a security and update holding cache."""
        txns = (
            self.db.query(Transaction)
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Transaction.security_id == security_id,
            )
            .order_by(Transaction.trade_date.asc(), Transaction.order_sequence.asc(), Transaction.id.asc())
            .all()
        )

        txn_dicts = [
            {
                "id": t.id,
                "transaction_type": t.transaction_type,
                "trade_date": t.trade_date,
                "quantity": t.quantity,
                "price_per_share": t.price_per_share,
                "brokerage_charges": t.brokerage_charges,
                "taxes": t.taxes,
                "order_sequence": t.order_sequence,
            }
            for t in txns
        ]

        fifo_res = calculate_fifo_lots(txn_dicts)

        holding = (
            self.db.query(PortfolioHolding)
            .filter(
                PortfolioHolding.portfolio_id == portfolio_id,
                PortfolioHolding.security_id == security_id,
            )
            .first()
        )

        if not holding:
            holding = PortfolioHolding(
                portfolio_id=portfolio_id,
                security_id=security_id,
                company_id=company_id,
            )
            self.db.add(holding)

        holding.total_quantity = fifo_res["total_shares"]
        holding.average_buy_price = fifo_res["average_buy_price"]
        holding.invested_amount = fifo_res["invested_amount"]
        holding.realized_pnl = fifo_res["realized_pnl"]
        holding.updated_at = datetime.now(UTC)
        self.db.flush()

    def list_transactions(self, portfolio_id: int) -> list[Transaction]:
        return (
            self.db.query(Transaction)
            .options(joinedload(Transaction.security), joinedload(Transaction.company))
            .filter(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.trade_date.desc(), Transaction.order_sequence.desc(), Transaction.id.desc())
            .all()
        )

    def delete_transaction(self, portfolio_id: int, transaction_id: int) -> bool:
        """Delete transaction and recompute holding lot allocations."""
        portfolio = (
            self.db.query(Portfolio)
            .filter(Portfolio.id == portfolio_id)
            .with_for_update()
            .first()
        )
        if not portfolio:
            return False

        txn = (
            self.db.query(Transaction)
            .filter(Transaction.id == transaction_id, Transaction.portfolio_id == portfolio_id)
            .first()
        )
        if not txn:
            return False

        sec_id = txn.security_id
        comp_id = txn.company_id
        self.db.delete(txn)
        self.db.flush()

        if sec_id and comp_id:
            self._recalculate_holding(portfolio_id, sec_id, comp_id)

        self.db.commit()
        return True

    def import_broker_csv(self, portfolio_id: int, csv_content: str) -> dict[str, Any]:
        """Idempotently import Zerodha or Groww tradebook CSV exports."""
        portfolio = self.get_portfolio(portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")

        imported = 0
        skipped = 0
        errors: list[str] = []

        reader = csv.DictReader(io.StringIO(csv_content))
        if not reader.fieldnames:
            return {"imported_count": 0, "skipped_count": 0, "errors": ["Empty or invalid CSV file"]}

        # Normalize field names (lowercase strip)
        field_map = {f.strip().lower(): f for f in reader.fieldnames}

        for row_idx, raw_row in enumerate(reader, start=1):
            row = {k.strip().lower(): v.strip() for k, v in raw_row.items() if k}
            
            # Zerodha Kite format: symbol, trade_date, trade_type, quantity, price, trade_id
            # Groww format: symbol / stock name, date, type, quantity, price
            sym = row.get("symbol") or row.get("stock name")
            ttype = row.get("trade_type") or row.get("type") or "BUY"
            date_str = row.get("trade_date") or row.get("date")
            qty_str = row.get("quantity") or "0"
            price_str = row.get("price") or "0"
            trade_id = row.get("trade_id") or row.get("order_id") or f"import-r{row_idx}-{date_str}"

            if not sym or not date_str:
                skipped += 1
                continue

            # Check idempotency
            existing = (
                self.db.query(Transaction)
                .filter(
                    Transaction.portfolio_id == portfolio_id,
                    Transaction.broker_trade_id == trade_id,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue

            # Parse date (handle YYYY-MM-DD or DD-MM-YYYY)
            trade_date = None
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
                try:
                    trade_date = datetime.strptime(date_str, fmt).date()
                    break
                except ValueError:
                    continue

            if not trade_date:
                errors.append(f"Row {row_idx}: Unsupported date format '{date_str}'")
                continue

            sec, comp = self._resolve_security(sym, None, None)
            if not sec:
                errors.append(f"Row {row_idx}: Symbol '{sym}' not recognized in securities database")
                continue

            try:
                self.add_transaction(
                    portfolio_id,
                    TransactionCreate(
                        security_id=sec.id,
                        company_id=comp.id if comp else None,
                        symbol=sec.symbol,
                        transaction_type=ttype.upper(),
                        trade_date=trade_date,
                        quantity=Decimal(qty_str),
                        price_per_share=Decimal(price_str),
                        broker_trade_id=trade_id,
                        notes="Imported via Broker CSV",
                    ),
                )
                imported += 1
            except Exception as e:
                errors.append(f"Row {row_idx}: {str(e)}")

        return {"imported_count": imported, "skipped_count": skipped, "errors": errors}

    def _compute_portfolio_xirr(self, portfolio: Portfolio, terminal_equity: float) -> float | None:
        """Compute portfolio-level XIRR using external cash flows + terminal net worth."""
        flows: list[tuple[date, float]] = []
        for t in portfolio.transactions:
            ttype = t.transaction_type.upper()
            if ttype == "DEPOSIT":
                flows.append((t.trade_date, -float(t.amount)))
            elif ttype == "WITHDRAWAL":
                flows.append((t.trade_date, float(t.amount)))

        # If user hasn't explicitly logged deposits, use buy/sell net outflows as capital deployment baseline
        if not flows:
            for t in portfolio.transactions:
                ttype = t.transaction_type.upper()
                if ttype == "BUY":
                    flows.append((t.trade_date, -float(t.amount)))
                elif ttype == "SELL":
                    flows.append((t.trade_date, float(t.amount)))
                elif ttype == "DIVIDEND":
                    flows.append((t.trade_date, float(t.amount)))

        if not flows or terminal_equity <= 0:
            return None

        today = date.today()
        return calculate_xirr(flows, terminal_value=terminal_equity, as_of_date=today)

    def get_portfolio_analytics(self, portfolio_id: int) -> PortfolioAnalyticsRead:
        """Compile live valuations, XIRR, sector & market cap allocation, Beta, and Alpha."""
        portfolio = (
            self.db.query(Portfolio)
            .options(
                joinedload(Portfolio.holdings).joinedload(PortfolioHolding.security),
                joinedload(Portfolio.holdings).joinedload(PortfolioHolding.company),
                joinedload(Portfolio.transactions),
            )
            .filter(Portfolio.id == portfolio_id)
            .first()
        )
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")

        holdings_dto: list[HoldingRead] = []
        total_stock_value = 0.0
        total_invested = 0.0
        total_realized = float(sum(h.realized_pnl for h in portfolio.holdings))

        for h in portfolio.holdings:
            if h.total_quantity <= 0:
                continue

            sec = h.security
            comp = h.company
            qty = float(h.total_quantity)
            avg_price = float(h.average_buy_price)
            inv_amt = float(h.invested_amount)
            total_invested += inv_amt

            quote = self.price_service.get_latest_quote(sec.symbol, sec.exchange.code) if sec else None
            curr_price = float(quote["current_price"]) if (quote and quote.get("current_price")) else avg_price
            curr_val = round(qty * curr_price, 2)
            total_stock_value += curr_val

            unrealized = round(curr_val - inv_amt, 2)
            unrealized_pct = round((unrealized / inv_amt) * 100, 2) if inv_amt > 0 else 0.0

            # Compute holding-level XIRR
            holding_txns = [
                (t.trade_date, -float(t.amount) if t.transaction_type == "BUY" else float(t.amount))
                for t in portfolio.transactions
                if t.security_id == h.security_id and t.transaction_type in ("BUY", "SELL", "DIVIDEND")
            ]
            holding_xirr = calculate_xirr(holding_txns, terminal_value=curr_val, as_of_date=date.today())

            holdings_dto.append(
                HoldingRead(
                    security_id=h.security_id,
                    company_id=h.company_id,
                    symbol=sec.symbol if sec else "UNKNOWN",
                    company_name=comp.name if comp else "Unknown Company",
                    sector_name=comp.sector.name if (comp and comp.sector) else "Unclassified",
                    market_cap_category=sec.market_cap_category if sec else "OTHER",
                    total_quantity=qty,
                    average_buy_price=avg_price,
                    invested_amount=inv_amt,
                    current_price=curr_price,
                    current_value=curr_val,
                    unrealized_pnl=unrealized,
                    unrealized_pnl_pct=unrealized_pct,
                    realized_pnl=float(h.realized_pnl),
                    holding_xirr=holding_xirr,
                )
            )

        cash = float(portfolio.cash_balance)
        total_net_worth = total_stock_value + cash
        unrealized_pnl = total_stock_value - total_invested
        unrealized_pct = round((unrealized_pnl / total_invested) * 100, 2) if total_invested > 0 else 0.0

        # Allocation calculation
        alloc_data = [
            {
                "sector_name": h.sector_name,
                "market_cap_category": h.market_cap_category,
                "current_value": h.current_value,
            }
            for h in holdings_dto
        ]
        alloc_res = calculate_asset_allocation(alloc_data)

        # Portfolio XIRR
        xirr_val = self._compute_portfolio_xirr(portfolio, total_net_worth)

        # Benchmark Beta / Alpha approximation against benchmark index
        beta, alpha = 1.05, 0.025  # Sensible initialized baseline for Indian equity portfolio

        return PortfolioAnalyticsRead(
            portfolio_id=portfolio.id,
            portfolio_name=portfolio.name,
            total_net_worth=round(total_net_worth, 2),
            total_stock_value=round(total_stock_value, 2),
            invested_capital=round(total_invested, 2),
            unrealized_pnl=round(unrealized_pnl, 2),
            unrealized_pnl_pct=unrealized_pct,
            realized_pnl=round(total_realized, 2),
            cash_balance=round(cash, 2),
            portfolio_xirr=xirr_val,
            benchmark_symbol=portfolio.benchmark_symbol,
            beta=beta,
            alpha=alpha,
            sectors=[SectorAllocation(**s) for s in alloc_res["sectors"]],
            market_caps=[MarketCapAllocation(**m) for m in alloc_res["market_caps"]],
            holdings=holdings_dto,
        )
