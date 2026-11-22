/** Habit colours: muted, distinguishable in light and dark mode. No gradients. */
export const HABIT_COLORS = [
  { value: "#0f766e", label: "Teal" },
  { value: "#3f7d3a", label: "Green" },
  { value: "#a16207", label: "Ochre" },
  { value: "#c2410c", label: "Orange" },
  { value: "#b42318", label: "Red" },
  { value: "#9d174d", label: "Berry" },
  { value: "#475569", label: "Slate" },
  { value: "#57534e", label: "Stone" },
] as const;

export const HABIT_COLOR_VALUES = HABIT_COLORS.map((c) => c.value) as [string, ...string[]];
export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0].value;

export const HABIT_ICON_NAMES = [
  "circle",
  "book-open",
  "dumbbell",
  "droplet",
  "footprints",
  "moon",
  "pen-line",
  "brain",
  "apple",
  "bike",
  "music",
  "code",
  "leaf",
  "heart",
  "sun",
  "pill",
  "smartphone",
] as const;

export type HabitIconName = (typeof HABIT_ICON_NAMES)[number];
export const DEFAULT_HABIT_ICON: HabitIconName = "circle";

export const FREQUENCIES = [
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
] as const;

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
