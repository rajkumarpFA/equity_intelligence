"""API Endpoints for Watchlists and Watchlist Items (Phase 13)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.workflow import (
    WatchlistCreate,
    WatchlistItemCreate,
    WatchlistItemRead,
    WatchlistItemUpdate,
    WatchlistRead,
    WatchlistUpdate,
)
from app.services.watchlist_service import WatchlistService

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])


@router.get("", response_model=list[WatchlistRead])
def list_watchlists(db: Session = Depends(get_db)) -> list[WatchlistRead]:
    """List all watchlists with enriched securities and current targets."""
    service = WatchlistService(db)
    return service.list_watchlists()


@router.post("", response_model=WatchlistRead, status_code=status.HTTP_201_CREATED)
def create_watchlist(
    payload: WatchlistCreate,
    db: Session = Depends(get_db),
) -> WatchlistRead:
    """Create a new watchlist."""
    service = WatchlistService(db)
    try:
        return service.create_watchlist(payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{watchlist_id}", response_model=WatchlistRead)
def get_watchlist(
    watchlist_id: int,
    db: Session = Depends(get_db),
) -> WatchlistRead:
    """Get single watchlist by ID."""
    service = WatchlistService(db)
    try:
        return service.get_watchlist(watchlist_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{watchlist_id}", response_model=WatchlistRead)
def update_watchlist(
    watchlist_id: int,
    payload: WatchlistUpdate,
    db: Session = Depends(get_db),
) -> WatchlistRead:
    """Update watchlist details."""
    service = WatchlistService(db)
    try:
        return service.update_watchlist(watchlist_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_watchlist(
    watchlist_id: int,
    db: Session = Depends(get_db),
):
    """Delete a watchlist."""
    service = WatchlistService(db)
    deleted = service.delete_watchlist(watchlist_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")


# ─── Watchlist Items ─────────────────────────────────────────────────────────


@router.post("/{watchlist_id}/items", response_model=WatchlistItemRead, status_code=status.HTTP_201_CREATED)
def add_item_to_watchlist(
    watchlist_id: int,
    payload: WatchlistItemCreate,
    db: Session = Depends(get_db),
) -> WatchlistItemRead:
    """Add a stock to a watchlist."""
    service = WatchlistService(db)
    try:
        return service.add_item(watchlist_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{watchlist_id}/items/{item_id}", response_model=WatchlistItemRead)
def update_watchlist_item(
    watchlist_id: int,
    item_id: int,
    payload: WatchlistItemUpdate,
    db: Session = Depends(get_db),
) -> WatchlistItemRead:
    """Update target entry/exit prices, conviction, or thesis notes."""
    service = WatchlistService(db)
    try:
        return service.update_item(watchlist_id, item_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{watchlist_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item_from_watchlist(
    watchlist_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    """Remove a stock from a watchlist."""
    service = WatchlistService(db)
    deleted = service.remove_item(watchlist_id, item_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist item not found")
