# Phase 14: Portfolio Analytics & Tracking Specification (Hardened Post-EGM Review)

## 1. Problem Statement
Investors analyzing Indian equities in Equity Intelligence currently track watchlists and research financial statements, but lack a unified, quantitative portfolio tracking and performance measurement system. They cannot measure their real money performance against Indian benchmarks (e.g., NIFTY 50), calculate cash-flow-adjusted returns (XIRR), track realized vs unrealized P&L, or visualize sectoral and market-cap asset allocation under the Apple Liquid Glass design language.

## 2. Goals & Non-Goals

### Goals
- **Multi-Portfolio Support**: Create and manage distinct portfolios (e.g. "Core Long-Term", "High Dividend", "Retirement").
- **Transaction Ledger**: Record `BUY`, `SELL`, `DIVIDEND`, `SPLIT`, `BONUS`, `DEPOSIT`, and `WITHDRAWAL` transactions with brokerage fees, statutory taxes (STT, GST, Stamp Duty), and execution timestamps.
- **Indian Tax Compliant FIFO Lot Matching (Section 55)**:
  - Deterministically match sell orders against historical buy lots to calculate realized P&L and remaining open lots.
  - **Stock Splits**: Proportionally adjust quantity ($Q \times R$) and per-share cost ($P / R$) of prior open lots, preserving original acquisition dates.
  - **Bonus Issues**: Leave prior open lots completely untouched. Allocate new distinct lots with `quantity = bonus_shares`, `cost_per_share = Decimal("0.0000")`, and `buy_date = allotment_date` per Section 55(2)(aa) of the Indian Income Tax Act.
- **Two-Tier XIRR Engine (ACT/365 Day Count)**:
  - **Portfolio-Level XIRR**: Measures true money-weighted return (MWR) based solely on external capital flows (`DEPOSIT` negative, `WITHDRAWAL` positive) plus current net portfolio equity value on valuation date (stocks market value $+$ uninvested cash balance).
  - **Holding-Level XIRR**: Measures individual security performance based on trade cash flows (`BUY` negative, `SELL` positive, `DIVIDEND` positive) plus current holding market value (`quantity * current_price`).
  - **Numerical Solver**: Newton-Raphson with bounded step clamping ($r \ge -0.999$), ACT/365 day count ($(d_i - d_0) / 365.0$), and automatic geometric bracket search with Brent's method fallback.
- **Benchmark Comparison (NIFTY 50)**: Calculate rolling Beta and Jensen's Alpha using daily unitized NAV returns against NIFTY 50 benchmark returns.
- **Asset Allocation Visualizations**: Sector distribution and Market-Cap tier breakdown (Large, Mid, Small Cap).
- **Idempotent Broker CSV Importer**: Import trade history from standard Indian broker exports (Zerodha Kite & Groww format) with `broker_trade_id` deduplication and corporate action reconciliation.
- **Apple Liquid Glass UI**: Responsive portfolio dashboard at `/portfolio` with unified panels, hairline borders, and live P&L chips.

### Non-Goals
- Real-time intraday automated order routing or execution via broker APIs.
- Derivatives (Futures & Options), Commodities, or Forex tracking (equities only in Phase 14).
- Multi-currency portfolio accounting (all portfolios are strictly denominated in INR).

---

## 3. Proposed Architecture

```
                    ┌──────────────────────────────┐
                    │      Next.js Frontend        │
                    │         (/portfolio)         │
                    │   Apple Liquid Glass View    │
                    └──────────────┬───────────────┘
                                   │ HTTP REST
                                   ▼
                    ┌──────────────────────────────┐
                    │     FastAPI Portfolio API    │
                    │  (/api/v1/portfolios/...)    │
                    └──────────────┬───────────────┘
                                   │
            ┌──────────────────────┴──────────────────────┐
            ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  Portfolio Service           │              │  Quantitative Engine         │
│  - Row-Level Locking (Mutex) │              │  (app/calculations/         │
│  - Ingestion / CSV parser    │              │   portfolio.py)              │
│  - Corporate Action Backfill │              │  - Tax-Compliant FIFO Engine │
│  - Dynamic Position View     │              │  - Two-Tier Brent-XIRR       │
└──────────────┬───────────────┘              │  - Unitized NAV Beta & Alpha │
               │                              │  - Allocation Categorizer    │
               ▼                              └──────────────────────────────┘
┌──────────────────────────────┐
│  PostgreSQL Relational DB    │
│  - portfolios                │
│  - transactions              │
│  - portfolio_holdings        │
└──────────────────────────────┘
```

### 3.1 Database Schema (`backend/app/models/portfolio.py`)
```python
class Portfolio(Base):
    __tablename__ = "portfolios"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    benchmark_symbol: Mapped[str] = mapped_column(String(20), default="^NSEI")  # NIFTY 50
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(20, 4), default=Decimal("0.0000"))
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "broker_trade_id", name="uq_portfolio_broker_trade"),
        Index("idx_txn_portfolio_security_date", "portfolio_id", "security_id", "trade_date", "order_sequence"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), index=True)
    
    # Linked to security_id to preserve exchange attribution and PriceHistory join
    security_id: Mapped[int | None] = mapped_column(ForeignKey("securities.id", ondelete="RESTRICT"), nullable=True, index=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True, index=True)
    
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False) # BUY, SELL, DIVIDEND, SPLIT, BONUS, DEPOSIT, WITHDRAWAL
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    trade_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    order_sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Nullable for cash-only flows (DEPOSIT/WITHDRAWAL/DIVIDEND)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    price_per_share: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False) # Total cash impact
    
    brokerage_charges: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.0000"))
    taxes: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.0000"))
    
    broker_trade_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

class PortfolioHolding(Base):
    """Cached aggregate position snapshot per security."""
    __tablename__ = "portfolio_holdings"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "security_id", name="uq_portfolio_security_holding"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), index=True)
    security_id: Mapped[int] = mapped_column(ForeignKey("securities.id", ondelete="CASCADE"), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    total_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0000"))
    average_buy_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0000"))
    invested_amount: Mapped[Decimal] = mapped_column(Numeric(20, 4), default=Decimal("0.0000"))
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(20, 4), default=Decimal("0.0000"))
    
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
```

### 3.2 Mathematical Algorithms (`backend/app/calculations/portfolio.py`)

1. **Tax-Compliant FIFO Lot Matching (Indian IT Act Sec 55)**:
   - Each `BUY` creates a lot: `{"lot_id": txn_id, "shares": Q, "cost_per_share": P, "buy_date": D}`.
   - On `SPLIT` (ratio $R$): For all existing open lots of that security, update:
     $$\text{shares} \leftarrow \text{shares} \times R, \quad \text{cost\_per\_share} \leftarrow \frac{\text{cost\_per\_share}}{R}$$
     Original `buy_date` is preserved.
   - On `BONUS` (ratio $M:N$): Existing open lots are unmodified. Create a new distinct lot:
     $$\text{shares} = \text{total\_existing\_shares} \times \frac{M}{N}, \quad \text{cost\_per\_share} = 0.0000, \quad \text{buy\_date} = \text{allotment\_date}$$
   - On `SELL`: Liquidate lots in chronological order (oldest `buy_date` first).
     $$\text{Realized P\&L} = \sum (\text{Sell Price} - \text{Lot Cost}) \times \text{Matched Shares} - \text{Allocated Fees}$$

2. **XIRR (ACT/365 Convention & Brent's Method)**:
   Solves for annual rate $r$ in the cash flow equation:
   $$\sum_{i=1}^N \frac{C_i}{(1 + r)^{(d_i - d_0) / 365.0}} = 0$$
   - **Scopes**:
     - *Portfolio-level*: $C_i$ are `DEPOSIT` ($-$), `WITHDRAWAL` ($+$), and terminal net worth on evaluation date ($+$ market value of stocks $+$ cash balance). Internal stock buys/sells do not create external flows.
     - *Holding-level*: $C_i$ are `BUY` ($-$), `SELL` ($+$), `DIVIDEND` ($+$), and current market value ($+$).
   - **Solver Routine**:
     1. Search for sign change interval $[a, b]$ across grid $r \in [-0.999, 50.0]$.
     2. If bracket found ($f(a) \cdot f(b) \le 0$), solve using Brent's method (`scipy.optimize.brentq` or pure Python equivalent).
     3. If no bracket or single flow pair, fallback to CAGR: $((V_{\text{final}} / V_{\text{initial}})^{(365.0 / \Delta d)} - 1)$.

3. **Beta & Jensen's Alpha (Unitized NAV Daily Returns)**:
   Daily portfolio return $R_p(t)$ is calculated using unitized Net Asset Value (NAV) so deposits/withdrawals do not distort returns:
   $$\text{NAV}_t = \frac{\text{Equity}_t}{\text{Units}_t}, \quad R_p(t) = \frac{\text{NAV}_t - \text{NAV}_{t-1}}{\text{NAV}_{t-1}}$$
   $$\beta = \frac{\text{Cov}(R_p, R_m)}{\text{Var}(R_m)}, \quad \alpha = \bar{R}_p - (\text{RiskFree} + \beta (\bar{R}_m - \text{RiskFree}))$$

---

## 4. Alternatives Considered

| Alternative | Rationale for Rejection |
| :--- | :--- |
| **Adjusting Prior Lots for Bonus Shares** | **Rejected**: Violates Section 55(2)(aa) of the Indian Income Tax Act. Bonus shares carry ₹0 acquisition cost and their holding period starts on allotment. Adjusting prior lots corrupts capital gains tax classification. |
| **Conflating Trades with Portfolio Cash Flows** | **Rejected**: In an active portfolio, recycling cash from sales to buy new stocks causes false multiple deposits/withdrawals, rendering portfolio XIRR mathematically meaningless. |
| **Foreign-Keying to `company_id` only** | **Rejected**: Loses exchange attribution (NSE vs BSE) and breaks foreign key joins with `PriceHistory` which indexes on `security_id`. |
| **Day Count ACT/365.25** | **Rejected**: Standard financial market convention (ACT/365) in India (NSE/BSE, Excel, Zerodha, Groww) uses 365.0 days. 365.25 creates a systematic 0.07% calculation drift. |

---

## 5. Concurrency & Data Integrity Guards

1. **Row-Level Mutex on Transaction Mutations**:
   All trade insertions, deletions, and batch CSV imports acquire a row-level lock on the parent `Portfolio` (`SELECT ... FOR UPDATE`), guaranteeing serialized lot allocations and eliminating race conditions.
2. **Broker CSV Reconciliation & Corporate Action Backfill**:
   Broker tradebook imports automatically check the existing `corporate_actions` table for splits or bonus issues between trade dates, backfilling split/bonus adjustments before enforcing position non-negativity checks.
3. **Idempotency Guard**:
   Transactions enforce `UniqueConstraint("portfolio_id", "broker_trade_id")`, allowing users to safely re-import tradebook CSVs without duplicating trade entries.
