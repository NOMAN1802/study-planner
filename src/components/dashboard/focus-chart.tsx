"use client";

import { useReducedMotion } from "motion/react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FOCUS_RANGES, formatMinutes, type FocusRange, type FocusSeries } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const RANGE_LABEL: Record<FocusRange, string> = { day: "Day", week: "Week", month: "Month" };
const RANGE_NOUN: Record<FocusRange, string> = {
  day: "today",
  week: "this week",
  month: "this month",
};

export function FocusChart({ series }: { series: Record<FocusRange, FocusSeries> }) {
  const [range, setRange] = useState<FocusRange>("week");
  const reduceMotion = useReducedMotion();
  const current = series[range];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          <span
            className="font-mono text-lg font-medium text-fg tabular-nums"
            data-testid="focus-total"
          >
            {formatMinutes(current.total)}
          </span>{" "}
          focused {RANGE_NOUN[range]}
        </p>
        <div
          role="group"
          aria-label="Focus range"
          className="inline-flex rounded-md border border-border bg-surface p-0.5"
        >
          {FOCUS_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "inline-flex h-7 items-center rounded px-3 text-[13px] transition-colors duration-150",
                range === r ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {current.total === 0 ? (
        <p className="flex h-48 items-center justify-center rounded-md border border-dashed border-border text-sm text-fg-muted">
          No focus sessions {RANGE_NOUN[range]} yet.
        </p>
      ) : (
        <div className="h-48" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer={false}
              data={current.buckets}
              margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--border-strong)" }}
                tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={6}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
                width={48}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                formatter={(value) => [`${value} min`, "Focus"]}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--fg)",
                }}
                labelStyle={{ color: "var(--fg-muted)" }}
              />
              <Bar
                dataKey="minutes"
                fill="var(--accent)"
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
                isAnimationActive={!reduceMotion}
                animationDuration={250}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Text equivalent of the chart for assistive tech. */}
      <ul className="sr-only" aria-label={`Focus minutes ${RANGE_NOUN[range]}`}>
        {current.buckets
          .filter((b) => b.minutes > 0)
          .map((b) => (
            <li key={b.key} data-testid="focus-bucket">
              {b.label}: {b.minutes} min
            </li>
          ))}
      </ul>
    </div>
  );
}
