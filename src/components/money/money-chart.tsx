"use client";

import { useReducedMotion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, type SeriesPoint } from "@/lib/money";

const short = (minor: number) => {
  const taka = minor / 100;
  if (taka >= 100_000) return `${Math.round(taka / 1000) / 100}L`;
  if (taka >= 1000) return `${Math.round(taka / 100) / 10}k`;
  return String(Math.round(taka));
};

/**
 * Income and expense side by side, per day (or per month for long ranges).
 * Decorative: the report lists the same totals as text.
 */
export function IncomeExpenseChart({ points }: { points: SeriesPoint[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="h-56" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer={false}
          data={points}
          margin={{ top: 6, right: 8, bottom: 0, left: -4 }}
          barGap={1}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border-strong)" }}
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            tickFormatter={short}
            width={44}
          />
          <Tooltip
            formatter={(value, name) => [formatMoney(Number(value)), name]}
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--fg)",
            }}
            labelStyle={{ color: "var(--fg-muted)" }}
          />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, color: "var(--fg-muted)" }}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--accent)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={!reduceMotion}
            animationDuration={250}
          />
          <Bar
            dataKey="expense"
            name="Expense"
            fill="var(--fg-muted)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={!reduceMotion}
            animationDuration={250}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
