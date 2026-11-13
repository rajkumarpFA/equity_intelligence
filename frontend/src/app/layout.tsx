import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/common/Sidebar";
import { QueryProvider } from "@/components/common/QueryProvider";

export const metadata: Metadata = {
  title: "Equity Intelligence — AI & Quantitative Equity Research Terminal",
  description:
    "Developer-grade quantitative research platform for Indian NSE and BSE equities with audited financial statements, DuPont models, and mathematical technical indicators.",
};

const themeInitScript = `
try {
  document.documentElement.classList.add("dark");
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-1)] antialiased font-sans select-none">
        <QueryProvider>
          <div className="flex h-full w-full overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden min-w-0">
              {children}
            </div>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
