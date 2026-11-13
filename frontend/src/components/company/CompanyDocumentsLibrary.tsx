"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  FileText,
  Download,
  Calendar,
  Upload,
  HardDrive,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { SourceDocumentListResponse } from "@/types/financials";
import { fetchSourceDocuments, getDocumentDownloadUrl } from "@/lib/api-client";
import { formatDate } from "@/lib/formatters";

interface CompanyDocumentsLibraryProps {
  companyId: number;
  companyName: string;
}

export function CompanyDocumentsLibrary({
  companyId,
  companyName,
}: CompanyDocumentsLibraryProps) {
  const {
    data: docsResponse,
    isLoading,
    isError,
  } = useQuery<SourceDocumentListResponse>({
    queryKey: ["company-source-documents", companyId],
    queryFn: () => fetchSourceDocuments({ company_id: companyId }),
    enabled: !!companyId,
  });

  const docs = docsResponse?.items ?? [];

  const formatFileSize = (bytes?: number | null) => {
    if (bytes == null || isNaN(Number(bytes))) return "—";
    const num = Number(bytes);
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#101828]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Annual Reports &amp; Filings Library
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Permanent repository of uploaded annual reports, exchange disclosures, and audited filings for {companyName}.
            </p>
          </div>

          <Link
            href="/data-management"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-[#00D3F3] hover:text-[#00D3F3] dark:border-white/10 dark:bg-[#131b2e] dark:text-slate-300 dark:hover:text-[#00D3F3] transition shadow-sm"
          >
            <Upload className="h-3.5 w-3.5 text-[#00D3F3]" />
            <span>Upload New Report</span>
          </Link>
        </div>

        {isLoading && (
          <div className="mt-4 h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        )}

        {isError && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Could not retrieve uploaded documents for {companyName}.
          </div>
        )}

        {!isLoading && !isError && docs.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 font-medium">No annual reports or filings uploaded for {companyName} yet.</p>
            <p className="mt-1 text-slate-400">
              Upload the company’s annual report PDF in Data Management to enable instant source traceability.
            </p>
            <Link
              href="/data-management"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Go to PDF Uploader</span>
            </Link>
          </div>
        )}

        {!isLoading && !isError && docs.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Fiscal Period</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Upload Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">
                            {doc.file_name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            SHA: {doc.sha256_hash.slice(0, 16)}...
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {doc.fiscal_year ? `FY${doc.fiscal_year}` : "—"}
                      {doc.fiscal_period ? ` (${doc.fiscal_period})` : ""}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {formatFileSize(doc.file_size_bytes)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {formatDate(doc.upload_timestamp)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={getDocumentDownloadUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700 transition"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download / View</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
