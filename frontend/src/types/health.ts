export interface DatabaseHealth {
  connected: boolean;
  latency_ms: number | null;
  error: string | null;
}

export interface HealthResponse {
  status: "healthy" | "degraded" | string;
  app_name: string;
  app_version: string;
  app_env: string;
  timestamp: string;
  database: DatabaseHealth;
  upstox_configured: boolean;
}
