"""Service for Watchlist and Watchlist Items management."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.company import Company, Security
from app.models.workflow import Watchlist, WatchlistItem
from app.schemas.workflow import (
    WatchlistCreate,
    WatchlistItemCreate,
    WatchlistItemRead,
    WatchlistItemUpdate,
    WatchlistRead,
    WatchlistUpdate,
)
from app.services.price_service import PriceService

logger = logging.getLogger(__name__)


class WatchlistService:
    """Manages user watchlists and company targets."""

    def __init__(self, db: Session):
        self.db = db
        self.price_service = PriceService()

    def _enrich_item(self, item: WatchlistItem) -> WatchlistItemRead:
        """Enrich a watchlist item with company details and live quote."""
        company = item.company
        primary_sec = next((s for s in company.securities if s.is_primary), None) if company and company.securities else None
        if not primary_sec and company and company.securities:
            primary_sec = company.securities[0]

        symbol = primary_sec.symbol if primary_sec else (company.name if company else "N/A")
        quote = None
        if primary_sec:
            quote = self.price_service.get_latest_quote(
                primary_sec.symbol, primary_sec.exchange.code if primary_sec.exchange else "NSE"
            )

        current_price = float(quote["current_price"]) if quote and quote.get("current_price") else None
        price_change = float(quote["price_change"]) if quote and quote.get("price_change") else None
        price_change_pct = float(quote["price_change_pct"]) if quote and quote.get("price_change_pct") else None

        distance_pct = None
        if current_price and item.target_entry_price and float(item.target_entry_price) > 0:
            target = float(item.target_entry_price)
            distance_pct = round(((current_price - target) / target) * 100.0, 2)

        return WatchlistItemRead(
            id=item.id,
            watchlist_id=item.watchlist_id,
            company_id=item.company_id,
            symbol=symbol,
            company_name=company.name if company else "Unknown",
            sector_name=company.sector.name if company and company.sector else None,
            industry_name=company.industry.name if company and company.industry else None,
            is_financial_sector=company.is_financial_sector if company else False,
            current_price=current_price,
            price_change=price_change,
            price_change_pct=price_change_pct,
            target_entry_price=float(item.target_entry_price) if item.target_entry_price else None,
            target_exit_price=float(item.target_exit_price) if item.target_exit_price else None,
            distance_to_entry_pct=distance_pct,
            conviction=item.conviction,
            thesis_summary=item.thesis_summary,
            notes=item.notes,
            added_at=item.added_at,
        )

    def list_watchlists(self) -> list[WatchlistRead]:
        """List all watchlists with enriched items."""
        query = (
            select(Watchlist)
            .options(
                selectinload(Watchlist.items)
                .selectinload(WatchlistItem.company)
                .selectinload(Company.securities)
                .selectinload(Security.exchange),
                selectinload(Watchlist.items)
                .selectinload(WatchlistItem.company)
                .selectinload(Company.sector),
                selectinload(Watchlist.items)
                .selectinload(WatchlistItem.company)
                .selectinload(Company.industry),
            )
            .order_by(Watchlist.created_at.asc())
        )
        watchlists = self.db.scalars(query).all()

        results = []
        for wl in watchlists:
            enriched_items = [self._enrich_item(it) for it in wl.items]
            results.append(
                WatchlistRead(
                    id=wl.id,
                    name=wl.name,
                    description=wl.description,
                    color=wl.color,
                    items_count=len(wl.items),
                    items=enriched_items,
                    created_at=wl.created_at,
                    updated_at=wl.updated_at,
                )
            )
        return results

    def get_watchlist(self, watchlist_id: int) -> WatchlistRead:
        """Get single watchlist by id."""
        query = (
            select(Watchlist)
            .where(Watchlist.id == watchlist_id)
            .options(
                selectinload(Watchlist.items)
                .selectinload(WatchlistItem.company)
                .selectinload(Company.securities)
                .selectinload(Security.exchange),
                selectinload(Watchlist.items)
                .selectinload(WatchlistItem.company)
                .selectinload(Company.sector),
                selectinload(Watchlist.items)
                .selectinload(WatchlistItem.company)
                .selectinload(Company.industry),
            )
        )
        wl = self.db.scalars(query).first()
        if not wl:
            raise ValueError(f"Watchlist #{watchlist_id} not found")

        enriched_items = [self._enrich_item(it) for it in wl.items]
        return WatchlistRead(
            id=wl.id,
            name=wl.name,
            description=wl.description,
            color=wl.color,
            items_count=len(wl.items),
            items=enriched_items,
            created_at=wl.created_at,
            updated_at=wl.updated_at,
        )

    def create_watchlist(self, watchlist_in: WatchlistCreate) -> WatchlistRead:
        """Create new watchlist."""
        existing = self.db.scalars(
            select(Watchlist).where(Watchlist.name == watchlist_in.name)
        ).first()
        if existing:
            raise ValueError(f"Watchlist with name '{watchlist_in.name}' already exists")

        wl = Watchlist(
            name=watchlist_in.name,
            description=watchlist_in.description,
            color=watchlist_in.color,
        )
        self.db.add(wl)
        self.db.commit()
        self.db.refresh(wl)
        return self.get_watchlist(wl.id)

    def update_watchlist(self, watchlist_id: int, update_in: WatchlistUpdate) -> WatchlistRead:
        """Update watchlist metadata."""
        wl = self.db.get(Watchlist, watchlist_id)
        if not wl:
            raise ValueError(f"Watchlist #{watchlist_id} not found")

        if update_in.name is not None:
            wl.name = update_in.name
        if update_in.description is not None:
            wl.description = update_in.description
        if update_in.color is not None:
            wl.color = update_in.color

        self.db.commit()
        return self.get_watchlist(wl.id)

    def delete_watchlist(self, watchlist_id: int) -> bool:
        """Delete watchlist."""
        wl = self.db.get(Watchlist, watchlist_id)
        if not wl:
            return False
        self.db.delete(wl)
        self.db.commit()
        return True

    def add_item(self, watchlist_id: int, item_in: WatchlistItemCreate) -> WatchlistItemRead:
        """Add company item to watchlist."""
        wl = self.db.get(Watchlist, watchlist_id)
        if not wl:
            raise ValueError(f"Watchlist #{watchlist_id} not found")

        company = self.db.get(Company, item_in.company_id)
        if not company:
            raise ValueError(f"Company ID #{item_in.company_id} not found")

        existing = self.db.scalars(
            select(WatchlistItem).where(
                WatchlistItem.watchlist_id == watchlist_id,
                WatchlistItem.company_id == item_in.company_id,
            )
        ).first()
        if existing:
            raise ValueError(f"Company is already in watchlist '{wl.name}'")

        item = WatchlistItem(
            watchlist_id=watchlist_id,
            company_id=item_in.company_id,
            target_entry_price=item_in.target_entry_price,
            target_exit_price=item_in.target_exit_price,
            conviction=item_in.conviction,
            thesis_summary=item_in.thesis_summary,
            notes=item_in.notes,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)

        # Load relationships
        query = (
            select(WatchlistItem)
            .where(WatchlistItem.id == item.id)
            .options(
                selectinload(WatchlistItem.company).selectinload(Company.securities).selectinload(Security.exchange),
                selectinload(WatchlistItem.company).selectinload(Company.sector),
                selectinload(WatchlistItem.company).selectinload(Company.industry),
            )
        )
        loaded = self.db.scalars(query).first()
        return self._enrich_item(loaded)

    def update_item(
        self, watchlist_id: int, item_id: int, item_in: WatchlistItemUpdate
    ) -> WatchlistItemRead:
        """Update watchlist item."""
        item = self.db.get(WatchlistItem, item_id)
        if not item or item.watchlist_id != watchlist_id:
            raise ValueError(f"Watchlist item #{item_id} not found in watchlist #{watchlist_id}")

        if item_in.target_entry_price is not None:
            item.target_entry_price = item_in.target_entry_price
        if item_in.target_exit_price is not None:
            item.target_exit_price = item_in.target_exit_price
        if item_in.conviction is not None:
            item.conviction = item_in.conviction
        if item_in.thesis_summary is not None:
            item.thesis_summary = item_in.thesis_summary
        if item_in.notes is not None:
            item.notes = item_in.notes

        self.db.commit()
        self.db.refresh(item)

        query = (
            select(WatchlistItem)
            .where(WatchlistItem.id == item.id)
            .options(
                selectinload(WatchlistItem.company).selectinload(Company.securities).selectinload(Security.exchange),
                selectinload(WatchlistItem.company).selectinload(Company.sector),
                selectinload(WatchlistItem.company).selectinload(Company.industry),
            )
        )
        loaded = self.db.scalars(query).first()
        return self._enrich_item(loaded)

    def remove_item(self, watchlist_id: int, item_id: int) -> bool:
        """Remove item from watchlist."""
        item = self.db.get(WatchlistItem, item_id)
        if not item or item.watchlist_id != watchlist_id:
            return False
        self.db.delete(item)
        self.db.commit()
        return True
