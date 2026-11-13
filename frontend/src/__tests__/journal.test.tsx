import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalView } from "@/components/journal/JournalView";
import * as apiClient from "@/lib/api-client";
import type { InvestmentNote } from "@/types/workflow";

vi.mock("@/lib/api-client", () => ({
  fetchJournalNotes: vi.fn(),
  createJournalNote: vi.fn(),
  updateJournalNote: vi.fn(),
  deleteJournalNote: vi.fn(),
  fetchCompanySearch: vi.fn(),
}));

const mockNotes: InvestmentNote[] = [
  {
    id: 1,
    company_id: 1,
    symbol: "RELIANCE",
    company_name: "Reliance Industries Limited",
    title: "New Energy Capex Inflection",
    category: "THESIS",
    conviction_score: 5,
    content: "Solar giga-factories commissioning ahead of schedule.",
    catalysts: [
      { title: "Solar cell facility rollout", target_date: "2027-03-31", status: "PENDING", impact: "HIGH" },
    ],
    key_risks: [
      { title: "Global refining margin squeeze", severity: "MEDIUM" },
    ],
    target_price: 1850.0,
    review_date: "2027-04-15T00:00:00Z",
    created_at: "2026-11-12T10:00:00Z",
    updated_at: "2026-11-12T10:00:00Z",
  },
  {
    id: 2,
    company_id: 3,
    symbol: "HDFCBANK",
    company_name: "HDFC Bank Limited",
    title: "Post-Merger Deposit Repricing",
    category: "EARNINGS",
    conviction_score: 4,
    content: "LDR ratio normalizing back towards 85%.",
    catalysts: [],
    key_risks: [],
    target_price: 2000.0,
    review_date: "2027-01-20T00:00:00Z",
    created_at: "2026-11-12T11:00:00Z",
    updated_at: "2026-11-12T11:00:00Z",
  },
];

describe("JournalView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchJournalNotes).mockResolvedValue(mockNotes);
  });

  it("renders journal header and displays notes stream", async () => {
    render(<JournalView />);

    expect(screen.getByText(/PHASE 13 • INVESTMENT JOURNAL/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("New Energy Capex Inflection")).toBeInTheDocument();
      expect(screen.getByText("Post-Merger Deposit Repricing")).toBeInTheDocument();
      expect(screen.getByText("RELIANCE")).toBeInTheDocument();
      expect(screen.getByText("HDFCBANK")).toBeInTheDocument();
    });
  });

  it("displays catalysts and key risks for thesis note", async () => {
    render(<JournalView />);

    await waitFor(() => {
      expect(screen.getByText("CATALYSTS & TRIGGERS")).toBeInTheDocument();
      expect(screen.getByText("Solar cell facility rollout")).toBeInTheDocument();
      expect(screen.getByText("KEY THESIS RISKS")).toBeInTheDocument();
      expect(screen.getByText("Global refining margin squeeze")).toBeInTheDocument();
    });
  });

  it("filters notes when category pill is selected", async () => {
    render(<JournalView />);

    await waitFor(() => {
      expect(screen.getByText("New Energy Capex Inflection")).toBeInTheDocument();
    });

    const earningsPill = screen.getByText("Earnings Review");
    fireEvent.click(earningsPill);

    expect(apiClient.fetchJournalNotes).toHaveBeenCalledWith({ category: "EARNINGS" });
  });
});
