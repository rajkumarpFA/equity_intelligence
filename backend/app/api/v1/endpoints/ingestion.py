"""FastAPI endpoints for data ingestion, background job audits, and file uploads."""

import math
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.ingestion.job_runner import ConcurrentJobExecutionError
from app.ingestion.scheduler import list_scheduled_jobs
from app.repositories.ingestion_repository import IngestionRepository
from app.schemas.ingestion import (
    IngestionJobListResponse,
    IngestionJobResponse,
    RejectedRecordListResponse,
    ScheduledJobResponse,
    SourceDocumentListResponse,
    SourceDocumentResponse,
    TriggerBenchmarkSyncRequest,
    TriggerPriceSyncRequest,
)
from app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/ingestion", tags=["Data Ingestion & Pipelines"])


@router.post("/initialize", summary="Seed standard financial metrics and default data sources")
def initialize_ingestion_metadata(db: Session = Depends(get_db)):
    """Idempotently seed the standard financial metrics catalog and default data sources."""
    service = IngestionService(db)
    result = service.initialize_metadata()
    return {"message": "Ingestion metadata initialized successfully", **result}


@router.post(
    "/trigger/price-sync",
    response_model=IngestionJobResponse,
    summary="Trigger on-demand historical price sync for a security",
)
def trigger_price_sync(
    request: TriggerPriceSyncRequest,
    db: Session = Depends(get_db),
):
    """Fetch and upsert historical EOD candlestick price data for a specific security."""
    service = IngestionService(db)
    try:
        job = service.sync_eod_prices_for_security(
            security_id=request.security_id,
            days=request.days,
            provider_name=request.provider_name,
            allow_reexecution=request.allow_reexecution,
        )
        return job
    except ConcurrentJobExecutionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Price sync failed: {e!s}")


@router.post(
    "/trigger/benchmark-sync",
    response_model=list[IngestionJobResponse],
    summary="Trigger price sync across all benchmark primary securities",
)
def trigger_benchmark_sync(
    request: TriggerBenchmarkSyncRequest,
    db: Session = Depends(get_db),
):
    """Batch synchronize historical daily candles for all active primary securities."""
    service = IngestionService(db)
    jobs = service.sync_all_benchmark_prices(days=request.days)
    return jobs


@router.get(
    "/jobs",
    response_model=IngestionJobListResponse,
    summary="List past and active ingestion jobs",
)
def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    job_type: str | None = None,
    db: Session = Depends(get_db),
):
    """Retrieve audit history of all data ingestion runs with execution metrics."""
    repo = IngestionRepository(db)
    skip = (page - 1) * page_size
    items, total = repo.list_jobs(skip=skip, limit=page_size, status=status_filter, job_type=job_type)
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return IngestionJobListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


@router.get(
    "/jobs/{job_id}",
    response_model=IngestionJobResponse,
    summary="Get single ingestion job detail",
)
def get_job(job_id: int, db: Session = Depends(get_db)):
    """Fetch detail and telemetry for a specific ingestion job."""
    repo = IngestionRepository(db)
    job = repo.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")
    return job


@router.post(
    "/upload/csv",
    response_model=IngestionJobResponse,
    summary="Upload financial statement or bhavcopy CSV for ingestion",
)
async def upload_csv_statement(
    file: UploadFile = File(...),
    company_id: int = Form(...),
    statement_type: str = Form("INCOME_STATEMENT"),
    reporting_basis: str = Form("CONSOLIDATED"),
    unit: str = Form("CRORES"),
    currency: str = Form("INR"),
    db: Session = Depends(get_db),
):
    """Upload and normalize a financial statement CSV with automated error quarantine."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Upload must be a .csv file.",
        )

    content = await file.read()
    service = IngestionService(db)

    try:
        job = service.ingest_statement_csv(
            file_content=content,
            filename=file.filename,
            company_id=company_id,
            statement_type=statement_type,
            reporting_basis=reporting_basis,
            unit=unit,
            currency=currency,
        )
        return job
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"CSV processing failed: {e!s}")


@router.post(
    "/upload/report",
    response_model=SourceDocumentResponse,
    summary="Upload corporate annual report or disclosure PDF",
)
async def upload_report(
    file: UploadFile = File(...),
    company_id: int | None = Form(None),
    fiscal_year: int | None = Form(None),
    fiscal_period: str | None = Form(None),
    document_type: str = Form("ANNUAL_REPORT"),
    db: Session = Depends(get_db),
):
    """Upload an annual report or disclosure document with SHA-256 deduplication."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    content = await file.read()
    service = IngestionService(db)

    try:
        doc, is_new = service.upload_document(
            file_bytes=content,
            filename=file.filename,
            mime_type=file.content_type or "application/pdf",
            document_type=document_type,
            company_id=company_id,
            fiscal_year=fiscal_year,
            fiscal_period=fiscal_period,
        )
        response = SourceDocumentResponse.model_validate(doc)
        response.is_duplicate = not is_new
        return response
    except ValueError as e:
        msg = str(e)
        if "exceeds maximum allowed limit" in msg:
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {e!s}")


@router.get(
    "/documents",
    response_model=SourceDocumentListResponse,
    summary="List uploaded corporate annual reports, filings, and datasets",
)
def list_documents(
    company_id: int | None = Query(None, description="Filter by company ID"),
    fiscal_year: int | None = Query(None, description="Filter by fiscal year"),
    document_type: str | None = Query(None, description="Filter by document type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List uploaded source documents with SHA-256 integrity and company metadata."""
    repo = IngestionRepository(db)
    offset = (page - 1) * page_size
    total, items = repo.list_source_documents(
        company_id=company_id,
        fiscal_year=fiscal_year,
        document_type=document_type,
        limit=page_size,
        offset=offset,
    )
    return SourceDocumentListResponse(
        total=total,
        items=[SourceDocumentResponse(**item) for item in items],
    )


@router.get(
    "/documents/{document_id}/download",
    summary="Download or view an uploaded report PDF or file",
)
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
):
    """Stream an uploaded source document directly by ID."""
    repo = IngestionRepository(db)
    doc = repo.get_source_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_path = Path(doc.file_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found on storage: {doc.file_name}",
        )

    return FileResponse(
        path=str(file_path),
        filename=doc.file_name,
        media_type=doc.mime_type or "application/pdf",
    )


@router.get(
    "/rejected-records",
    response_model=RejectedRecordListResponse,
    summary="List quarantined rejected records for audit and review",
)
def list_rejected_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    review_status: str | None = None,
    job_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Inspect all quarantined or rejected records to ensure zero silent data loss."""
    repo = IngestionRepository(db)
    skip = (page - 1) * page_size
    items, total = repo.list_rejected_records(skip=skip, limit=page_size, review_status=review_status, job_id=job_id)
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return RejectedRecordListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


@router.get(
    "/scheduled-jobs",
    response_model=list[ScheduledJobResponse],
    summary="List registered background scheduled tasks",
)
def get_scheduled_jobs():
    """Retrieve active cron triggers and next run times for background jobs."""
    jobs = list_scheduled_jobs()
    return jobs
