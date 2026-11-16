import { z } from "zod";
import { MAX_BLOCK_MINUTES, MIN_BLOCK_MINUTES, MINUTE_MS } from "@/lib/planner";

const instant = z
  .number()
  .int()
  .min(Date.UTC(2000, 0, 1))
  .max(Date.UTC(2100, 0, 1));

export const spanSchema = z
  .object({ start: instant, end: instant })
  .refine((s) => s.end - s.start >= MIN_BLOCK_MINUTES * MINUTE_MS, {
    message: `A block must be at least ${MIN_BLOCK_MINUTES} minutes`,
    path: ["end"],
  })
  .refine((s) => s.end - s.start <= MAX_BLOCK_MINUTES * MINUTE_MS, {
    message: "A block can't be longer than 24 hours",
    path: ["end"],
  });

export const createBlockSchema = z
  .object({ kind: z.enum(["task", "habit"]), refId: z.uuid() })
  .and(spanSchema);

export type CreateBlockInput = z.input<typeof createBlockSchema>;
