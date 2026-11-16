"use client";

import { motion, MotionConfig, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type ProgressRingProps = {
  /** 0–1 */
  ratio: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  children?: ReactNode;
};

/** Circular progress; the arc animates from its previous value when `ratio` changes. */
export function ProgressRing({
  ratio,
  size = 64,
  stroke = 6,
  color = "var(--accent)",
  label,
  children,
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, ratio));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative inline-flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - clamped) }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
            data-testid="ring-arc"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      </div>
    </MotionConfig>
  );
}
