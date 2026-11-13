"""Company service implementing stock discovery, taxonomy, and deduplication workflows."""

import logging
import math

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.company import Company, Security
from app.repositories.company_repository import CompanyRepository
from app.schemas.company import (
    CompanyCreate,
    CompanyRead,
    CompanySearchItem,
    CompanySearchResponse,
    IndustryRead,
    SectorRead,
    SecurityCreate,
    SecurityRead,
)
from app.services.price_service import PriceService


class CompanyService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CompanyRepository(db)
        self.price_service = PriceService()

    def _format_security_read(self, security: Security) -> SecurityRead:
        return SecurityRead(
            id=security.id,
            exchange_code=security.exchange.code,
            exchange_name=security.exchange.name,
            symbol=security.symbol,
            series=security.series,
            exchange_token=security.exchange_token,
            provider_instrument_key=security.provider_instrument_key,
            is_primary=security.is_primary,
            is_active=security.is_active,
            lot_size=security.lot_size,
            market_cap_category=security.market_cap_category,
        )

    def _format_company_read(self, company: Company, refresh: bool = False) -> CompanyRead:
        sector_dto = SectorRead.model_validate(company.sector) if company.sector else None
        industry_dto = IndustryRead.model_validate(company.industry) if company.industry else None
        securities_dto = [self._format_security_read(s) for s in company.securities]

        # Fetch latest price for primary/first security
        primary_sec = next((s for s in company.securities if s.is_primary), None)
        if not primary_sec and company.securities:
            primary_sec = company.securities[0]

        quote = None
        if primary_sec:
            quote = self.price_service.get_latest_quote(
                primary_sec.symbol, primary_sec.exchange.code, force_refresh=refresh
            )

        return CompanyRead(
            id=company.id,
            name=company.name,
            legal_name=company.legal_name,
            isin=company.isin,
            cin=company.cin,
            sector=sector_dto,
            industry=industry_dto,
            is_financial_sector=company.is_financial_sector,
            accounting_standard=company.accounting_standard,
            paid_up_capital=company.paid_up_capital,
            face_value=company.face_value,
            description=company.description,
            website=company.website,
            status=company.status,
            current_price=quote["current_price"] if quote else None,
            price_change=quote["price_change"] if quote else None,
            price_change_pct=quote["price_change_pct"] if quote else None,
            price_date=quote["price_date"] if quote else None,
            securities=securities_dto,
            created_at=company.created_at,
            updated_at=company.updated_at,
        )

    def _format_search_item(self, company: Company, quote: dict | None = None) -> CompanySearchItem:
        securities_dto = [self._format_security_read(s) for s in company.securities]
        primary_sec = next((s for s in company.securities if s.is_primary), None)
        if not primary_sec and company.securities:
            primary_sec = company.securities[0]

        exchange_listings = sorted({s.exchange.code for s in company.securities})

        return CompanySearchItem(
            id=company.id,
            name=company.name,
            isin=company.isin,
            cin=company.cin,
            sector_name=company.sector.name if company.sector else None,
            industry_name=company.industry.name if company.industry else None,
            is_financial_sector=company.is_financial_sector,
            status=company.status,
            primary_symbol=primary_sec.symbol if primary_sec else None,
            exchange_listings=exchange_listings,
            current_price=quote["current_price"] if quote else None,
            price_change=quote["price_change"] if quote else None,
            price_change_pct=quote["price_change_pct"] if quote else None,
            price_date=quote["price_date"] if quote else None,
            securities=securities_dto,
        )

    def search_companies(
        self,
        query: str | None = None,
        sector_id: int | None = None,
        industry_id: int | None = None,
        exchange_code: str | None = None,
        page: int = 1,
        page_size: int = 20,
        refresh: bool = False,
    ) -> CompanySearchResponse:
        total, companies = self.repo.search_companies(
            query=query,
            sector_id=sector_id,
            industry_id=industry_id,
            exchange_code=exchange_code,
            page=page,
            page_size=page_size,
        )
        total_pages = math.ceil(total / page_size) if total > 0 else 1

        # Fetch batch quotes for visible companies
        symbols = []
        for c in companies:
            primary_sec = next((s for s in c.securities if s.is_primary), None)
            if not primary_sec and c.securities:
                primary_sec = c.securities[0]
            if primary_sec:
                symbols.append(primary_sec.symbol)

        # Read only cached quotes during search/browsing; never trigger batch external network calls
        quotes = (
            self.price_service.get_cached_quotes_for_symbols(symbols)
            if symbols
            else {}
        )

        items = []
        for c in companies:
            primary_sec = next((s for s in c.securities if s.is_primary), None)
            if not primary_sec and c.securities:
                primary_sec = c.securities[0]
            q = quotes.get(primary_sec.symbol.upper()) if primary_sec else None
            items.append(self._format_search_item(c, q))

        return CompanySearchResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=items,
        )

    def get_company_by_id(self, company_id: int, refresh: bool = False) -> CompanyRead | None:
        company = self.repo.get_company_by_id(company_id)
        if company and company.sector_id is None and company.securities:
            prim = next((s for s in company.securities if s.is_primary), company.securities[0])
            sec_name, ind_name, is_fin = self._resolve_sector_and_industry(
                prim.symbol, prim.exchange.code, company.name
            )
            if sec_name:
                sec = self.repo.get_or_create_sector(sec_name)
                company.sector_id = sec.id
                if ind_name:
                    ind = self.repo.get_or_create_industry(sec.id, ind_name)
                    company.industry_id = ind.id
                company.is_financial_sector = is_fin
                self.repo.db.commit()
                self.repo.db.refresh(company)
        return self._format_company_read(company, refresh=refresh) if company else None

    def get_company_by_isin(self, isin: str) -> CompanyRead | None:
        company = self.repo.get_company_by_isin(isin)
        return self._format_company_read(company) if company else None

    def upsert_company(self, data: CompanyCreate) -> CompanyRead:
        company = self.repo.upsert_canonical_company(data)
        return self._format_company_read(company)

    def _resolve_sector_and_industry(
        self, symbol: str, exchange: str, company_name: str
    ) -> tuple[str, str, bool]:
        """Automatically resolve sector and industry taxonomy for Indian equities."""
        clean_symbol = symbol.strip().upper()
        clean_exchange = exchange.strip().upper()
        clean_name = company_name.strip().upper()

        # 1. Try Yahoo Finance search API (open, no auth required)
        import httpx

        ticker = f"{clean_symbol}.NS" if clean_exchange == "NSE" else f"{clean_symbol}.BO"
        raw_sector = None
        raw_industry = None

        try:
            r = httpx.get(
                f"https://query1.finance.yahoo.com/v1/finance/search?q={ticker}",
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=5.0,
            )
            if r.status_code == 200:
                quotes = r.json().get("quotes", [])
                for q in quotes:
                    sym = q.get("symbol", "").upper()
                    if sym in (ticker, clean_symbol):
                        raw_sector = q.get("sectorDisp") or q.get("sector")
                        raw_industry = q.get("industryDisp") or q.get("industry")
                        break
                # If exact ticker match wasn't in quotes, take the first equity quote
                if not raw_sector and quotes:
                    for q in quotes:
                        if q.get("quoteType") == "EQUITY" and (q.get("sectorDisp") or q.get("sector")):
                            raw_sector = q.get("sectorDisp") or q.get("sector")
                            raw_industry = q.get("industryDisp") or q.get("industry")
                            break
        except (httpx.HTTPError, KeyError, IndexError, TypeError) as exc:
            logger.debug("Sector search query failed for %s: %s", ticker, exc)

        # 2. Map standard global sectors to canonical platform sectors
        sector_map = {
            "Financial Services": "Financials",
            "Financial": "Financials",
            "Technology": "Technology",
            "Consumer Defensive": "Consumer Staples",
            "Consumer Cyclical": "Consumer Discretionary",
            "Healthcare": "Healthcare & Pharmaceuticals",
            "Energy": "Energy & Petrochemicals",
            "Industrials": "Capital Goods & Industrials",
            "Basic Materials": "Metals & Mining",
            "Communication Services": "Telecommunications & Media",
            "Utilities": "Utilities & Power",
            "Real Estate": "Real Estate & Infrastructure",
        }

        if raw_sector and raw_sector in sector_map:
            resolved_sector = sector_map[raw_sector]
            resolved_industry = raw_industry or f"{resolved_sector} Services"
            is_financial = resolved_sector == "Financials" or any(
                w in clean_name for w in ["BANK", "FINANCIAL", "FINANCE", "HOUSING", "INSURANCE"]
            )
            return resolved_sector, resolved_industry, is_financial

        if raw_sector:
            resolved_sector = raw_sector
            resolved_industry = raw_industry or f"{raw_sector} Operations"
            is_financial = any(
                w in clean_name for w in ["BANK", "FINANCIAL", "FINANCE", "HOUSING", "INSURANCE"]
            )
            return resolved_sector, resolved_industry, is_financial

        # 3. Intelligent heuristic keyword classification as deterministic fallback
        if any(
            w in clean_name
            for w in [
                "BANK",
                "FINANCIAL",
                "FINANCE",
                "HOUSING FINANCE",
                "INSURANCE",
                "MUTUAL",
                "SECURITIES",
                "CAPITAL",
            ]
        ):
            return "Financials", "Banking & Financial Services", True

        if any(
            w in clean_name
            for w in [
                "SOFTWARE",
                "TECH",
                "INFOTECH",
                "DIGITAL",
                "SYSTEMS",
                "COMPUTERS",
                "CONSULTANCY",
                "INFOSYS",
                "WIPRO",
            ]
        ):
            return "Technology", "IT Services", False

        if any(
            w in clean_name
            for w in [
                "PHARMA",
                "LABORATORIES",
                "HEALTHCARE",
                "BIO",
                "DRUGS",
                "HOSPITAL",
                "MEDICINE",
            ]
        ):
            return "Healthcare & Pharmaceuticals", "Pharmaceuticals", False

        if any(w in clean_name for w in ["MOTORS", "AUTO", "TYRES", "AUTOMOTIVE", "VEHICLES"]):
            return "Automotive", "Automobiles & Auto Components", False

        if any(
            w in clean_name
            for w in ["ENERGY", "POWER", "SOLAR", "WIND", "PETRO", "REFINERY", "OIL", "GAS"]
        ):
            return "Energy & Petrochemicals", "Oil, Gas & Consumable Fuels", False

        if any(
            w in clean_name
            for w in [
                "STEEL",
                "MINING",
                "MINERALS",
                "METALS",
                "ALUMINIUM",
                "COPPER",
                "ZINC",
                "IRON",
            ]
        ):
            return "Metals & Mining", "Metals & Mining", False

        if any(
            w in clean_name
            for w in [
                "FOOD",
                "BEVERAGES",
                "BREWERIES",
                "DAIRY",
                "CONSUMER",
                "SUGAR",
                "TOBACCO",
                "FMCG",
            ]
        ):
            return "Consumer Goods", "Fast Moving Consumer Goods (FMCG)", False

        if any(
            w in clean_name
            for w in [
                "CEMENT",
                "INFRA",
                "ENGINEERING",
                "CONSTRUCTION",
                "PROJECTS",
                "INFRASTRUCTURE",
            ]
        ):
            return "Capital Goods & Industrials", "Engineering & Construction", False

        if any(
            w in clean_name
            for w in ["TELECOM", "COMMUNICATIONS", "NETWORKS", "AIRTEL", "BROADBAND"]
        ):
            return "Telecommunications & Media", "Telecom Services", False

        if any(w in clean_name for w in ["CHEMICALS", "FERTILIZERS", "ORGANICS", "PESTICIDES"]):
            return "Chemicals", "Specialty Chemicals", False

        return "Diversified", "Diversified Commercial Services", False

    def import_company_by_symbol(self, symbol: str, exchange: str = "NSE") -> CompanyRead:
        """On-demand lookup and addition of any NSE/BSE listed stock into local PostgreSQL."""
        clean_symbol = symbol.strip().upper()
        clean_exchange = exchange.strip().upper()

        # 1. Check if already exists in DB
        _total, existing_list = self.repo.search_companies(query=clean_symbol, page=1, page_size=10)
        for c in existing_list:
            for s in c.securities:
                if s.symbol.upper() == clean_symbol and s.exchange.code.upper() == clean_exchange:
                    # If existing company is missing a sector, automatically resolve and backfill it
                    if c.sector_id is None:
                        sec_name, ind_name, is_fin = self._resolve_sector_and_industry(
                            clean_symbol, clean_exchange, c.name
                        )
                        sec = self.repo.get_or_create_sector(sec_name)
                        ind = self.repo.get_or_create_industry(sec.id, ind_name)
                        c.sector_id = sec.id
                        c.industry_id = ind.id
                        c.is_financial_sector = is_fin
                        self.repo.db.commit()
                        self.repo.db.refresh(c)
                    return self._format_company_read(c)

        # 2. Look up in Upstox instrument master (open public CDN)
        import asyncio

        from app.providers.upstox.adapter import UpstoxProvider

        upstox = UpstoxProvider()
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as pool:
                    instruments = pool.submit(
                        asyncio.run, upstox.get_instrument_master(clean_exchange)
                    ).result()
            else:
                instruments = loop.run_until_complete(upstox.get_instrument_master(clean_exchange))
        except (RuntimeError, OSError):
            instruments = asyncio.run(upstox.get_instrument_master(clean_exchange))

        found = next((i for i in instruments if i.symbol.upper() == clean_symbol), None)

        if found:
            name = found.name
            isin = found.isin
            series = found.series or "EQ"
            inst_key = found.provider_instrument_key
        else:
            # Fallback to Yahoo Finance metadata
            import httpx

            ticker = f"{clean_symbol}.NS" if clean_exchange == "NSE" else f"{clean_symbol}.BO"
            try:
                r = httpx.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d",
                    headers={"User-Agent": "Mozilla/5.0"},
                    timeout=8.0,
                )
                if r.status_code == 200:
                    meta = r.json().get("chart", {}).get("result", [{}])[0].get("meta", {})
                    name = meta.get("shortName") or meta.get("longName") or clean_symbol
                    isin = f"IN{clean_symbol[:9]}01"
                    series = "EQ"
                    inst_key = f"{clean_exchange}_EQ|{isin}"
                else:
                    raise ValueError(f"Stock symbol '{clean_symbol}' not found on {clean_exchange}")
            except Exception as exc:
                raise ValueError(
                    f"Could not resolve stock '{clean_symbol}' on {clean_exchange}: {exc}"
                ) from exc

        # 3. Automatically resolve sector and industry taxonomy
        sector_name, industry_name, is_financial = self._resolve_sector_and_industry(
            clean_symbol, clean_exchange, name
        )

        # 4. Create canonical Company and Security mapping
        company_create = CompanyCreate(
            name=name,
            legal_name=name,
            isin=isin,
            sector_name=sector_name,
            industry_name=industry_name,
            is_financial_sector=is_financial,
            securities=[
                SecurityCreate(
                    exchange_code=clean_exchange,
                    symbol=clean_symbol,
                    is_primary=True,
                    series=series,
                    provider_instrument_key=inst_key,
                )
            ],
        )
        company = self.repo.upsert_canonical_company(company_create)

        # 5. Fetch initial price snapshot
        self.price_service.get_latest_quote(clean_symbol, clean_exchange, force_refresh=True)

        return self._format_company_read(company)

    def list_sectors(self) -> list[SectorRead]:
        sectors = self.repo.get_all_sectors()
        return [SectorRead.model_validate(s) for s in sectors]

    def seed_initial_universe_if_empty(self) -> int:
        """Seed foundational benchmark companies with dual NSE/BSE mappings if table is empty."""
        total, _ = self.repo.search_companies(page=1, page_size=1)
        if total > 0:
            return 0

        initial_companies: list[CompanyCreate] = [
            CompanyCreate(
                name="Reliance Industries Limited",
                legal_name="Reliance Industries Limited",
                isin="INE002A01018",
                cin="L17110MH1973PLC019786",
                sector_name="Energy & Petrochemicals",
                industry_name="Refineries & Marketing",
                is_financial_sector=False,
                face_value=10.0,
                description="Indian multinational conglomerate operating in petrochemicals, refining, telecom, and retail.",
                website="https://www.ril.com",
                securities=[
                    SecurityCreate(
                        exchange_code="NSE",
                        symbol="RELIANCE",
                        is_primary=True,
                        market_cap_category="LARGE_CAP",
                        provider_instrument_key="NSE_EQ|INE002A01018",
                    ),
                    SecurityCreate(
                        exchange_code="BSE",
                        symbol="500325",
                        is_primary=False,
                        market_cap_category="LARGE_CAP",
                        provider_instrument_key="BSE_EQ|INE002A01018",
                    ),
                ],
            ),
            CompanyCreate(
                name="Tata Consultancy Services Limited",
                legal_name="Tata Consultancy Services Limited",
                isin="INE467B01029",
                cin="L22210MH1995PLC084781",
                sector_name="Information Technology",
                industry_name="IT Services & Consulting",
                is_financial_sector=False,
                face_value=1.0,
                description="Global leader in IT services, consulting, and business solutions.",
                website="https://www.tcs.com",
                securities=[
                    SecurityCreate(
                        exchange_code="NSE",
                        symbol="TCS",
                        is_primary=True,
                        market_cap_category="LARGE_CAP",
                        provider_instrument_key="NSE_EQ|INE467B01029",
                    ),
                    SecurityCreate(
                        exchange_code="BSE",
                        symbol="532540",
                        is_primary=False,
                        market_cap_category="LARGE_CAP",
                        provider_instrument_key="BSE_EQ|INE467B01029",
                    ),
                ],
            ),
            CompanyCreate(
                name="HDFC Bank Limited",
                legal_name="HDFC Bank Limited",
                isin="INE040A01034",
                cin="L65920MH1994PLC080618",
                sector_name="Financial Services",
                industry_name="Private Sector Bank",
                is_financial_sector=True,  # Crucial: Financial Sector accounting model
                face_value=1.0,
                description="India's largest private sector bank providing banking and financial services.",
                website="https://www.hdfcbank.com",
                securities=[
                    SecurityCreate(
                        exchange_code="NSE",
                        symbol="HDFCBANK",
                        is_primary=True,
                        market_cap_category="LARGE_CAP",
                        provider_instrument_key="NSE_EQ|INE040A01034",
                    ),
                    SecurityCreate(
                        exchange_code="BSE",
                        symbol="500180",
                        is_primary=False,
                        market_cap_category="LARGE_CAP",
                        provider_instrument_key="BSE_EQ|INE040A01034",
                    ),
                ],
            ),
            CompanyCreate(
                name="Suzlon Energy Limited",
                legal_name="Suzlon Energy Limited",
                isin="INE040H01021",
                cin="L40100GJ1995PLC025447",
                sector_name="Capital Goods",
                industry_name="Renewable Energy Equipment",
                is_financial_sector=False,
                face_value=2.0,
                description="Renewable energy solutions provider offering wind energy equipment and services.",
                website="https://www.suzlon.com",
                securities=[
                    SecurityCreate(
                        exchange_code="NSE",
                        symbol="SUZLON",
                        is_primary=True,
                        market_cap_category="MID_CAP",
                        provider_instrument_key="NSE_EQ|INE040H01021",
                    ),
                    SecurityCreate(
                        exchange_code="BSE",
                        symbol="532667",
                        is_primary=False,
                        market_cap_category="MID_CAP",
                        provider_instrument_key="BSE_EQ|INE040H01021",
                    ),
                ],
            ),
            CompanyCreate(
                name="Tata Motors Limited",
                legal_name="Tata Motors Limited",
                isin="INE155A01022",
                cin="L28920MH1945PLC004520",
                sector_name="Automobile and Auto Components",
                industry_name="Commercial Vehicles & Cars",
                is_financial_sector=False,
                face_value=2.0,
                description="Global automobile manufacturing company producing cars, utility vehicles, buses, and trucks.",
                website="https://www.tatamotors.com",
                securities=[
                    SecurityCreate(
                        exchange_code="NSE",
                        symbol="TATAMOTORS",
                        is_primary=True,
                        market_cap_category="LARGE_CAP",
                        provider_instrument_key="NSE_EQ|INE155A01022",
                    ),
                    SecurityCreate(
                        exchange_code="BSE",
                        symbol="500570",
                        is_primary=False,
                        market_cap_category="LARGE_CAP",
                        provider_instrument_key="BSE_EQ|INE155A01022",
                    ),
                ],
            ),
            CompanyCreate(
                name="Tanla Platforms Limited",
                legal_name="Tanla Platforms Limited",
                isin="INE483A01010",
                cin="L72200TG1995PLC021262",
                sector_name="Information Technology",
                industry_name="CPaaS & Cloud Communications",
                is_financial_sector=False,
                face_value=1.0,
                description="Cloud communications provider (small-cap benchmark).",
                website="https://www.tanla.com",
                securities=[
                    SecurityCreate(
                        exchange_code="NSE",
                        symbol="TANLA",
                        is_primary=True,
                        market_cap_category="SMALL_CAP",
                        provider_instrument_key="NSE_EQ|INE483A01010",
                    ),
                    SecurityCreate(
                        exchange_code="BSE",
                        symbol="532790",
                        is_primary=False,
                        market_cap_category="SMALL_CAP",
                        provider_instrument_key="BSE_EQ|INE483A01010",
                    ),
                ],
            ),
            CompanyCreate(
                name="Tata Technologies Limited",
                legal_name="Tata Technologies Limited",
                isin="INE142M01025",
                cin="U72200PN1994PLC013313",
                sector_name="Information Technology",
                industry_name="ER&D Services",
                is_financial_sector=False,
                face_value=2.0,
                description="Global engineering services provider (recently listed benchmark company).",
                website="https://www.tatatechnologies.com",
                securities=[
                    SecurityCreate(
                        exchange_code="NSE",
                        symbol="TATATECH",
                        is_primary=True,
                        market_cap_category="MID_CAP",
                        provider_instrument_key="NSE_EQ|INE142M01025",
                    ),
                    SecurityCreate(
                        exchange_code="BSE",
                        symbol="544028",
                        is_primary=False,
                        market_cap_category="MID_CAP",
                        provider_instrument_key="BSE_EQ|INE142M01025",
                    ),
                ],
            ),
        ]

        for comp in initial_companies:
            self.upsert_company(comp)

        return len(initial_companies)
