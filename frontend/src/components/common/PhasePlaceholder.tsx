import { Header } from "@/components/common/Header";
import { Layers } from "lucide-react";

interface PhasePlaceholderProps {
  title: string;
  subtitle: string;
  phaseLabel: string;
  description: string;
}

export function PhasePlaceholder({
  title,
  subtitle,
  phaseLabel,
  description,
}: PhasePlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title={title} subtitle={subtitle} />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                {phaseLabel}
              </span>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {description}
          </p>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            No demonstration or fabricated market data is displayed here; real sourced records will appear once this module is implemented and populated.
          </p>
        </div>
      </main>
    </div>
  );
}
