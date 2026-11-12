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
  const s = localStorage.getItem("color-scheme");
  if (s === "dark" || (!s && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  } else {
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
      <body className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#090d16] dark:text-slate-100 antialiased">
        <QueryProvider>
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
