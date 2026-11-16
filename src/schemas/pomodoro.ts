import { z } from "zod";

const minutes = (label: string, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(1, `${label} must be at least 1`)
    .max(max, `${label} must be at most ${max}`);

export const pomodoroConfigSchema = z.object({
  focusMinutes: minutes("Focus", 180),
  shortBreakMinutes: minutes("Short break", 60),
  longBreakMinutes: minutes("Long break", 120),
  cyclesBeforeLongBreak: z.coerce
    .number({ error: "Cycles must be a number" })
    .int("Cycles must be a whole number")
    .min(1, "Cycles must be at least 1")
    .max(12, "Cycles must be at most 12"),
  autoStartNext: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export type PomodoroConfigField = keyof z.input<typeof pomodoroConfigSchema>;
export type PomodoroConfigState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<PomodoroConfigField, string>>;
};

export function pomodoroConfigValues(formData: FormData) {
  return {
    focusMinutes: formData.get("focusMinutes"),
    shortBreakMinutes: formData.get("shortBreakMinutes"),
    longBreakMinutes: formData.get("longBreakMinutes"),
    cyclesBeforeLongBreak: formData.get("cyclesBeforeLongBreak"),
    autoStartNext: formData.get("autoStartNext"),
  };
}

export function pomodoroConfigErrors(error: z.ZodError): PomodoroConfigState["fieldErrors"] {
  const out: PomodoroConfigState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as PomodoroConfigField;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
