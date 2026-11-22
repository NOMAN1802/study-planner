"use client";

import { useReducedMotion } from "motion/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayScore } from "@/lib/daily-habits";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (day: string) => `${Number(day.slice(8))} ${MONTH[Number(day.slice(5, 7)) - 1]}`;

/**
 * The day score line (the right edge of the habit journal). Decorative: the
 * same numbers are in the tracker grid and the report's tables.
 */
export function ScoreTrend({ days }: { days: DayScore[] }) {
  const reduceMotion = useReducedMotion();
  const points = days.map((d) => ({ day: d.day, label: label(d.day), pct: d.pct }));
  return (
    <div className="h-44" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          accessibilityLayer={false}
          data={points}
          margin={{ top: 6, right: 8, bottom: 0, left: -4 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border-strong)" }}
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            width={48}
            unit="%"
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "Score"]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--fg)",
            }}
            labelStyle={{ color: "var(--fg-muted)" }}
          />
          <Line
            type="linear"
            dataKey="pct"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={points.length <= 62 ? { r: 2.5, fill: "var(--accent)" } : false}
            connectNulls={false}
            isAnimationActive={!reduceMotion}
            animationDuration={250}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
