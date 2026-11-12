import { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HealthIndicator } from "@/components/common/HealthIndicator";
import { QueryProvider } from "@/components/common/QueryProvider";
import * as apiClient from "@/lib/api-client";

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("HealthIndicator", () => {
  it("renders healthy indicator when backend and database are connected", async () => {
    vi.spyOn(apiClient, "fetchSystemHealth").mockResolvedValue({
      status: "healthy",
      app_name: "Equity Intelligence",
      app_version: "0.1.0",
      app_env: "test",
      timestamp: "2026-11-12T22:45:00Z",
      database: {
        connected: true,
        latency_ms: 2.1,
        error: null,
      },
      upstox_configured: false,
    });

    render(
      <QueryProvider client={createTestClient()}>
        <HealthIndicator />
      </QueryProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/API & DB Healthy/i)).toBeInTheDocument();
      expect(screen.getByText(/2.1 ms/i)).toBeInTheDocument();
    });
  });

  it("renders degraded indicator when database is disconnected", async () => {
    vi.spyOn(apiClient, "fetchSystemHealth").mockResolvedValue({
      status: "degraded",
      app_name: "Equity Intelligence",
      app_version: "0.1.0",
      app_env: "test",
      timestamp: "2026-11-12T22:45:00Z",
      database: {
        connected: false,
        latency_ms: 10.0,
        error: "Connection refused",
      },
      upstox_configured: false,
    });

    render(
      <QueryProvider client={createTestClient()}>
        <HealthIndicator />
      </QueryProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/API Degraded/i)).toBeInTheDocument();
    });
  });

  it("renders offline indicator when API fetch fails", async () => {
    vi.spyOn(apiClient, "fetchSystemHealth").mockRejectedValue(
      new Error("Network Error")
    );

    render(
      <QueryProvider client={createTestClient()}>
        <HealthIndicator />
      </QueryProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/API Offline/i)).toBeInTheDocument();
    });
  });
});
