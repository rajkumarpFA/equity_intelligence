import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/common/Sidebar";
import { QueryProvider } from "@/components/common/QueryProvider";

export const metadata: Metadata = {
  title: "Equity Intelligence — Quantitative Equity Research Terminal",
  description:
    "Institutional-grade quantitative equity research terminal for Indian equities with audited financials, multi-model intrinsic valuation, and forensic analysis.",
};

const themeInitScript = `
try {
  const stored = localStorage.getItem("color-scheme");
  if (stored === "dark") {
    document.documentElement.classList.add("dark");
  } else if (stored === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    // Default to Apple Liquid Glass light ground
    document.documentElement.classList.remove("dark");
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-1)] antialiased font-sans select-none">
        <QueryProvider>
          <div className="flex h-full w-full overflow-hidden">
            <Sidebar />
            <main className="flex flex-1 flex-col overflow-hidden min-w-0" role="main">
              {children}
            </main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
