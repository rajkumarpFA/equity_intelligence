import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, Sidebar } from "@/components/common/Sidebar";

// Mock next/navigation usePathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Sidebar Navigation", () => {
  it("renders all 10 specification navigation items", () => {
    render(<Sidebar />);

    expect(screen.getByText("Equity Intelligence")).toBeInTheDocument();

    for (const item of NAV_ITEMS) {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    }
    expect(NAV_ITEMS).toHaveLength(10);
  });
});
