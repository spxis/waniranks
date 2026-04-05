"use client";

import { useMemo, useState } from "react";
import { toRomaji } from "wanakana";

type JlptItem = {
  kanji: string;
  nLevel: number;
};

type Props = {
  items: JlptItem[];
};

type JlptFilter = "all" | "n5" | "n4" | "n3" | "n2" | "n1";

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

function normalizeSearch(input: string): string {
  return input.trim().toLowerCase();
}

export default function JlptExplorer({ items }: Props) {
  const [levelFilter, setLevelFilter] = useState<JlptFilter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    return {
      all: items.length,
      n5: items.filter((item) => item.nLevel === 5).length,
      n4: items.filter((item) => item.nLevel === 4).length,
      n3: items.filter((item) => item.nLevel === 3).length,
      n2: items.filter((item) => item.nLevel === 2).length,
      n1: items.filter((item) => item.nLevel === 1).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    return items.filter((item) => {
      const levelPass =
        levelFilter === "all" ? true : item.nLevel === Number(levelFilter.slice(1));

      if (!levelPass) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const romaji = normalizeSearch(toRomaji(item.kanji, { upcaseKatakana: false }));
      return (
        item.kanji.includes(query.trim()) ||
        normalizeSearch(item.kanji).includes(normalizedQuery) ||
        romaji.includes(normalizedQuery)
      );
    });
  }, [items, levelFilter, query]);

  function badgeClass(active: boolean): string {
    return active
      ? "border-accent bg-accent text-white"
      : "border-line bg-white text-slate-700 hover:bg-surface-muted";
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-xl font-black text-foreground">JLPT Explorer</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-slate-600">
              Browse all N1-N5 kanji ({formatNumber(items.length)} total)
            </p>
          </div>
          <div className="rounded-full border border-line bg-white px-2 py-1">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search JLPT kanji"
              className="h-9 w-full rounded-full bg-transparent px-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-500"
              aria-label="Search JLPT explorer"
            />
          </div>
        </div>
      </header>

      <div className="border-b border-line px-5 py-4">
        <section className="rounded-2xl border border-line bg-surface-muted/60 p-3 sm:p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Filters</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["all", "JLPT All", counts.all],
              ["n5", "N5", counts.n5],
              ["n4", "N4", counts.n4],
              ["n3", "N3", counts.n3],
              ["n2", "N2", counts.n2],
              ["n1", "N1", counts.n1],
            ] as const).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLevelFilter(value)}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                  levelFilter === value,
                )}`}
              >
                {label} ({formatNumber(count)})
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
          Showing {formatNumber(filteredItems.length)} results
        </p>
        <p className="mt-1 text-xs text-slate-500">
          WaniKani-specific SRS stats are shown only where subject mappings exist.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {filteredItems.map((item) => (
            <article
              key={`${item.nLevel}-${item.kanji}`}
              className="rounded-2xl border border-line bg-white p-3 text-center"
            >
              <p className="subject-pill border-line bg-white text-slate-700">N{item.nLevel}</p>
              <p className="mt-2 text-5xl font-black text-foreground">{item.kanji}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                WK stats pending
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
