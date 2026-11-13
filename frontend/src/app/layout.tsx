import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/common/Sidebar";
import { QueryProvider } from "@/components/common/QueryProvider";

export const metadata: Metadata = {
  title: "Equity Intelligence — Indian Stock Research Platform",
  description:
    "Unified personal research platform for Indian NSE and BSE equity discovery, valuation, and monitoring.",
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
      <body className="flex h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-1)] antialiased font-sans select-none bg-teal-glow">
        <QueryProvider>
          <div className="flex h-full w-full overflow-hidden bg-matrix-dots">
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
