"use client";

import { useState } from "react";

const DECADES = ["1950s", "1960s", "1970s", "1980s", "1990s"] as const;
type Decade = (typeof DECADES)[number];

const CATEGORIES: { label: string; class: number }[] = [
  { label: "Apothecary", class: 3 },
  { label: "Hardware", class: 8 },
  { label: "Eyewear/Electronics", class: 9 },
  { label: "Lighting/Appliances", class: 11 },
  { label: "Jewelry/Watches", class: 14 },
  { label: "Publishing/Stationery", class: 16 },
  { label: "Leather Goods/Bags", class: 18 },
  { label: "Furniture", class: 20 },
  { label: "Kitchen/Homewares", class: 21 },
  { label: "Fashion/Apparel", class: 25 },
];

type ScoutResult = {
  success: boolean;
  inserted?: number;
  candidates?: number;
  survivors?: number;
  brands?: Array<{
    word: string;
    niceClass: number;
    aesthetic_score: number;
    mood_board_prompt: string;
  }>;
  error?: string;
  step?: string;
  detail?: unknown;
  geminiErrors?: Array<{ word: string; error: string }>;
};

export default function ScoutPage() {
  const [decade, setDecade] = useState<Decade>("1970s");
  const [niceClass, setNiceClass] = useState<number>(CATEGORIES[0].class);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoutResult | null>(null);

  const runScout = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decade, niceClass }),
      });
      const data = (await res.json()) as ScoutResult;
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-stone-100">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12 border-b border-stone-700/60 pb-8">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-amber-400/80">
            Australian Market Intelligence
          </p>
          <h1 className="font-display text-5xl font-semibold tracking-tight">
            Zombie Brand Scout
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-400">
            Surface abandoned Australian trademarks ripe for revival. Pick an
            era and a product class, and the scout will hunt, validate, and
            enrich dormant brands ready to be rebooted.
          </p>
        </header>

        <section className="rounded-2xl border border-stone-700/60 bg-stone-900/60 p-8 shadow-2xl backdrop-blur">
          <div className="grid gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-400">
                Decade
              </span>
              <select
                value={decade}
                onChange={(e) => setDecade(e.target.value as Decade)}
                className="rounded-lg border border-stone-700 bg-stone-950/80 px-4 py-3 text-base text-stone-100 outline-none transition focus:border-amber-500"
              >
                {DECADES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-400">
                Category (Nice Class)
              </span>
              <select
                value={niceClass}
                onChange={(e) => setNiceClass(Number(e.target.value))}
                className="rounded-lg border border-stone-700 bg-stone-950/80 px-4 py-3 text-base text-stone-100 outline-none transition focus:border-amber-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.class} value={c.class}>
                    {c.label} (Class {c.class})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            onClick={runScout}
            disabled={loading}
            className="mt-8 w-full rounded-lg bg-amber-500 px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
          >
            {loading ? "Scouting…" : "Run Scout"}
          </button>
        </section>

        {loading && (
          <div className="mt-8 flex items-center gap-3 text-sm text-stone-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Hunting dormant trademarks, validating domains, and consulting the
            appraiser…
          </div>
        )}

        {result && !loading && (
          <section className="mt-8 rounded-2xl border border-stone-700/60 bg-stone-900/60 p-8">
            {result.success ? (
              <>
                <h2 className="font-display text-2xl font-semibold">
                  Scout Report
                </h2>
                <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-stone-400">Candidates</dt>
                    <dd className="mt-1 text-2xl font-semibold text-amber-400">
                      {result.candidates ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-400">Survivors</dt>
                    <dd className="mt-1 text-2xl font-semibold text-amber-400">
                      {result.survivors ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-400">Inserted</dt>
                    <dd className="mt-1 text-2xl font-semibold text-amber-400">
                      {result.inserted ?? 0}
                    </dd>
                  </div>
                </dl>

                {result.brands && result.brands.length > 0 && (
                  <ul className="mt-6 divide-y divide-stone-800">
                    {result.brands.map((b, i) => (
                      <li key={i} className="py-4">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="font-display text-lg font-medium">
                            {b.word}
                          </span>
                          <span className="text-xs text-stone-400">
                            Class {b.niceClass} · Aesthetic{" "}
                            <span className="text-amber-400">
                              {b.aesthetic_score}/10
                            </span>
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-stone-400">
                          {b.mood_board_prompt}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {result.geminiErrors && result.geminiErrors.length > 0 && (
                  <div className="mt-6 rounded-lg border border-red-900/60 bg-red-950/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-red-400">
                      Gemini enrichment failed
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-stone-300">
                      {result.geminiErrors.map((g, i) => (
                        <li key={i}>
                          <span className="font-medium">{g.word}</span>:{" "}
                          <span className="text-stone-400">{g.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-red-400">
                <p className="font-medium">Scout failed</p>
                {result.step && (
                  <p className="mt-1 text-xs uppercase tracking-wider text-amber-400">
                    Step: {result.step}
                  </p>
                )}
                <p className="mt-2 text-stone-300">{result.error}</p>
                {result.detail !== undefined && result.detail !== null && (
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-stone-950 p-3 text-xs text-stone-400">
                    {typeof result.detail === "string"
                      ? result.detail
                      : JSON.stringify(result.detail, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
