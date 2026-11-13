"""Company repository handling queries, search, deduplication, and persistence."""

from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company, Exchange, Industry, Sector, Security
from app.schemas.company import CompanyCreate, SecurityCreate


class CompanyRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_exchange(self, code: str, name: str | None = None) -> Exchange:
        code_upper = code.strip().upper()
        exchange = self.db.execute(
            select(Exchange).where(Exchange.code == code_upper)
        ).scalar_one_or_none()
        if not exchange:
            exchange_name = name or (
                "National Stock Exchange" if code_upper == "NSE" else "Bombay Stock Exchange"
            )
            exchange = Exchange(code=code_upper, name=exchange_name)
            self.db.add(exchange)
            self.db.flush()
        return exchange

    def get_or_create_sector(self, name: str) -> Sector:
        name_clean = name.strip()
        sector = self.db.execute(
            select(Sector).where(func.lower(Sector.name) == name_clean.lower())
        ).scalar_one_or_none()
        if not sector:
            sector = Sector(name=name_clean)
            self.db.add(sector)
            self.db.flush()
        return sector

    def get_or_create_industry(self, sector_id: int, name: str) -> Industry:
        name_clean = name.strip()
        industry = self.db.execute(
            select(Industry).where(
                Industry.sector_id == sector_id,
                func.lower(Industry.name) == name_clean.lower(),
            )
        ).scalar_one_or_none()
        if not industry:
            industry = Industry(sector_id=sector_id, name=name_clean)
            self.db.add(industry)
            self.db.flush()
        return industry

    def get_company_by_id(self, company_id: int) -> Company | None:
        stmt = (
            select(Company)
            .where(Company.id == company_id)
            .options(
                joinedload(Company.sector),
                joinedload(Company.industry),
                joinedload(Company.securities).joinedload(Security.exchange),
            )
        )
        return self.db.execute(stmt).unique().scalar_one_or_none()

    get_by_id = get_company_by_id

    def get_company_by_isin(self, isin: str) -> Company | None:
        isin_clean = isin.strip().upper()
        stmt = (
            select(Company)
            .where(Company.isin == isin_clean)
            .options(
                joinedload(Company.sector),
                joinedload(Company.industry),
                joinedload(Company.securities).joinedload(Security.exchange),
            )
        )
        return self.db.execute(stmt).unique().scalar_one_or_none()

    def upsert_canonical_company(self, data: CompanyCreate) -> Company:
        """Upsert canonical company by ISIN, attaching or updating exchange securities."""
        isin_clean = data.isin.strip().upper()
        company = self.get_company_by_isin(isin_clean)

        sector_id = None
        industry_id = None
        if data.sector_name:
            sector = self.get_or_create_sector(data.sector_name)
            sector_id = sector.id
            if data.industry_name:
                industry = self.get_or_create_industry(sector_id, data.industry_name)
                industry_id = industry.id

        if not company:
            company = Company(
                name=data.name.strip(),
                legal_name=data.legal_name.strip() if data.legal_name else None,
                isin=isin_clean,
                cin=data.cin.strip().upper() if data.cin else None,
                sector_id=sector_id,
                industry_id=industry_id,
                is_financial_sector=data.is_financial_sector,
                accounting_standard=data.accounting_standard,
                paid_up_capital=data.paid_up_capital,
                face_value=data.face_value,
                description=data.description,
                website=data.website,
                status=data.status,
            )
            self.db.add(company)
            self.db.flush()
        else:
            # Update fields if provided
            company.name = data.name.strip()
            if data.legal_name:
                company.legal_name = data.legal_name.strip()
            if data.cin:
                company.cin = data.cin.strip().upper()
            if sector_id:
                company.sector_id = sector_id
            if industry_id:
                company.industry_id = industry_id
            company.is_financial_sector = data.is_financial_sector
            if data.accounting_standard:
                company.accounting_standard = data.accounting_standard
            if data.paid_up_capital is not None:
                company.paid_up_capital = data.paid_up_capital
            if data.face_value is not None:
                company.face_value = data.face_value
            if data.description:
                company.description = data.description
            if data.website:
                company.website = data.website
            company.status = data.status

        # Process securities for this company
        for sec in data.securities:
            self.upsert_security(company.id, sec)

        self.db.commit()
        return self.get_company_by_id(company.id)  # Refresh with eager-loaded relationships

    def upsert_security(self, company_id: int, data: SecurityCreate) -> Security:
        exchange = self.get_or_create_exchange(data.exchange_code)
        symbol_clean = data.symbol.strip().upper()

        stmt = select(Security).where(
            Security.exchange_id == exchange.id,
            Security.symbol == symbol_clean,
        )
        security = self.db.execute(stmt).scalar_one_or_none()

        if not security:
            security = Security(
                company_id=company_id,
                exchange_id=exchange.id,
                symbol=symbol_clean,
                series=data.series.upper(),
                exchange_token=data.exchange_token,
                provider_instrument_key=data.provider_instrument_key,
                is_primary=data.is_primary,
                is_active=data.is_active,
                lot_size=data.lot_size,
                market_cap_category=data.market_cap_category,
            )
            self.db.add(security)
        else:
            # Re-point to canonical company if previously detached or duplicate
            security.company_id = company_id
            security.series = data.series.upper()
            if data.exchange_token:
                security.exchange_token = data.exchange_token
            if data.provider_instrument_key:
                security.provider_instrument_key = data.provider_instrument_key
            security.is_primary = data.is_primary
            security.is_active = data.is_active
            security.lot_size = data.lot_size
            if data.market_cap_category:
                security.market_cap_category = data.market_cap_category

        self.db.flush()
        return security

    def search_companies(
        self,
        query: str | None = None,
        sector_id: int | None = None,
        industry_id: int | None = None,
        exchange_code: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[int, list[Company]]:
        """Search companies matching query text across company name, ISIN, CIN, and exchange trading symbols."""
        base_stmt = select(Company.id, Company.name).select_from(Company)

        joins_needed = []
        conditions = []

        if query and query.strip():
            q_clean = f"%{query.strip().lower()}%"
            # Join securities to search symbols
            joins_needed.append("securities")
            conditions.append(
                or_(
                    func.lower(Company.name).like(q_clean),
                    func.lower(Company.isin).like(q_clean),
                    func.lower(Company.cin).like(q_clean),
                    func.lower(Security.symbol).like(q_clean),
                )
            )

        if sector_id:
            conditions.append(Company.sector_id == sector_id)

        if industry_id:
            conditions.append(Company.industry_id == industry_id)

        if exchange_code:
            joins_needed.append("securities")
            joins_needed.append("exchange")
            conditions.append(func.lower(Exchange.code) == exchange_code.strip().lower())

        if "securities" in joins_needed:
            base_stmt = base_stmt.outerjoin(Company.securities)
        if "exchange" in joins_needed:
            base_stmt = base_stmt.outerjoin(Security.exchange)

        if conditions:
            base_stmt = base_stmt.where(*conditions)

        # Count total
        count_stmt = select(func.count(distinct(base_stmt.subquery().c.id)))
        total = self.db.execute(count_stmt).scalar() or 0

        if total == 0:
            return 0, []

        # Paginate IDs with distinct (id, name)
        offset = (page - 1) * page_size
        paginated_id_stmt = (
            base_stmt.distinct().order_by(Company.name.asc()).offset(offset).limit(page_size)
        )
        rows = self.db.execute(paginated_id_stmt).all()
        company_ids = [r[0] for r in rows]

        if not company_ids:
            return total, []

        # Fetch full company records with eager joins
        fetch_stmt = (
            select(Company)
            .where(Company.id.in_(company_ids))
            .options(
                joinedload(Company.sector),
                joinedload(Company.industry),
                joinedload(Company.securities).joinedload(Security.exchange),
            )
            .order_by(Company.name.asc())
        )
        companies = self.db.execute(fetch_stmt).unique().scalars().all()
        return total, list(companies)

    def get_all_sectors(self) -> list[Sector]:
        stmt = select(Sector).options(joinedload(Sector.industries)).order_by(Sector.name.asc())
        return list(self.db.execute(stmt).unique().scalars().all())
