"""API endpoints for Portfolio Management, Transactions, and Analytics."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.portfolio import (
    CSVImportResponse,
    PortfolioAnalyticsRead,
    PortfolioCreate,
    PortfolioRead,
    PortfolioUpdate,
    TransactionCreate,
    TransactionRead,
)
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/portfolios", tags=["Portfolios"])


@router.get("", response_model=list[PortfolioRead])
def list_portfolios(db: Session = Depends(get_db)) -> list[PortfolioRead]:
    """List all portfolios with aggregate equity values and performance."""
    service = PortfolioService(db)
    return service.list_portfolios()


@router.post("", response_model=PortfolioRead, status_code=status.HTTP_201_CREATED)
def create_portfolio(
    payload: PortfolioCreate,
    db: Session = Depends(get_db),
) -> PortfolioRead:
    """Create a new portfolio."""
    service = PortfolioService(db)
    try:
        p = service.create_portfolio(payload)
        # Return enriched read
        all_p = service.list_portfolios()
        return next((x for x in all_p if x.id == p.id), PortfolioRead.model_validate(p))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{portfolio_id}", response_model=PortfolioRead)
def get_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db),
) -> PortfolioRead:
    """Get single portfolio by ID with performance summary."""
    service = PortfolioService(db)
    portfolios = service.list_portfolios()
    p = next((x for x in portfolios if x.id == portfolio_id), None)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Portfolio {portfolio_id} not found")
    return p


@router.put("/{portfolio_id}", response_model=PortfolioRead)
def update_portfolio(
    portfolio_id: int,
    payload: PortfolioUpdate,
    db: Session = Depends(get_db),
) -> PortfolioRead:
    """Update portfolio metadata or cash balance."""
    service = PortfolioService(db)
    p = service.update_portfolio(portfolio_id, payload)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Portfolio {portfolio_id} not found")
    all_p = service.list_portfolios()
    return next((x for x in all_p if x.id == portfolio_id), PortfolioRead.model_validate(p))


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db),
) -> None:
    """Delete a portfolio and all associated transactions and holdings."""
    service = PortfolioService(db)
    success = service.delete_portfolio(portfolio_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Portfolio {portfolio_id} not found")


@router.get("/{portfolio_id}/transactions", response_model=list[TransactionRead])
def list_transactions(
    portfolio_id: int,
    db: Session = Depends(get_db),
) -> list[TransactionRead]:
    """List historical transaction ledger for a portfolio."""
    service = PortfolioService(db)
    txns = service.list_transactions(portfolio_id)
    results: list[TransactionRead] = []
    for t in txns:
        results.append(
            TransactionRead(
                id=t.id,
                portfolio_id=t.portfolio_id,
                security_id=t.security_id,
                company_id=t.company_id,
                symbol=t.security.symbol if t.security else None,
                company_name=t.company.name if t.company else None,
                transaction_type=t.transaction_type,
                trade_date=t.trade_date,
                trade_time=t.trade_time,
                order_sequence=t.order_sequence,
                quantity=float(t.quantity) if t.quantity is not None else None,
                price_per_share=float(t.price_per_share) if t.price_per_share is not None else None,
                amount=float(t.amount),
                brokerage_charges=float(t.brokerage_charges),
                taxes=float(t.taxes),
                broker_trade_id=t.broker_trade_id,
                notes=t.notes,
                created_at=t.created_at,
            )
        )
    return results


@router.post("/{portfolio_id}/transactions", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def add_transaction(
    portfolio_id: int,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
) -> TransactionRead:
    """Log a BUY, SELL, DIVIDEND, SPLIT, BONUS, DEPOSIT, or WITHDRAWAL transaction."""
    service = PortfolioService(db)
    try:
        t = service.add_transaction(portfolio_id, payload)
        return TransactionRead(
            id=t.id,
            portfolio_id=t.portfolio_id,
            security_id=t.security_id,
            company_id=t.company_id,
            symbol=t.security.symbol if t.security else payload.symbol,
            company_name=t.company.name if t.company else None,
            transaction_type=t.transaction_type,
            trade_date=t.trade_date,
            trade_time=t.trade_time,
            order_sequence=t.order_sequence,
            quantity=float(t.quantity) if t.quantity is not None else None,
            price_per_share=float(t.price_per_share) if t.price_per_share is not None else None,
            amount=float(t.amount),
            brokerage_charges=float(t.brokerage_charges),
            taxes=float(t.taxes),
            broker_trade_id=t.broker_trade_id,
            notes=t.notes,
            created_at=t.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{portfolio_id}/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    portfolio_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
) -> None:
    """Delete a transaction and re-run FIFO lot allocation."""
    service = PortfolioService(db)
    success = service.delete_transaction(portfolio_id, transaction_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transaction {transaction_id} not found")


@router.post("/{portfolio_id}/import-csv", response_model=CSVImportResponse)
async def import_broker_csv(
    portfolio_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> CSVImportResponse:
    """Import trades from a broker tradebook CSV file (Zerodha Kite or Groww format)."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension. Broker tradebook must be a .csv file, got '{file.filename}'",
        )

    # Enforce maximum upload size limit (15MB)
    max_bytes = 15 * 1024 * 1024
    content_bytes = await file.read(max_bytes + 1)
    if len(content_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Broker CSV upload exceeds maximum allowed limit of 15 MB",
        )

    content = content_bytes.decode("utf-8", errors="replace")
    service = PortfolioService(db)
    try:
        res = service.import_broker_csv(portfolio_id, content)
        return CSVImportResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{portfolio_id}/analytics", response_model=PortfolioAnalyticsRead)
def get_portfolio_analytics(
    portfolio_id: int,
    db: Session = Depends(get_db),
) -> PortfolioAnalyticsRead:
    """Get complete real-time portfolio analytics, holdings P&L, XIRR, Beta, Alpha, and allocation."""
    service = PortfolioService(db)
    try:
        return service.get_portfolio_analytics(portfolio_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
