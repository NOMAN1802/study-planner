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

export type TrendPoint = { id: string; label: string; exam: string; pct: number };

/** Real exam scores (%) over time. Decorative: the panel lists the same scores as text. */
export function ExamTrend({ points }: { points: TrendPoint[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="h-40" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          accessibilityLayer={false}
          data={points}
          margin={{ top: 6, right: 8, bottom: 0, left: -16 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border-strong)" }}
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={8}
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
            formatter={(value, _name, item) => [`${value}%`, item.payload.exam]}
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
            type="monotone"
            dataKey="pct"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--accent)" }}
            isAnimationActive={!reduceMotion}
            animationDuration={250}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
