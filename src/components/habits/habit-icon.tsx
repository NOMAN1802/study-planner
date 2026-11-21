import {
  Apple,
  Bike,
  BookOpen,
  Brain,
  Circle,
  Code,
  Droplet,
  Dumbbell,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  PenLine,
  Pill,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { HabitIconName } from "@/lib/habit-options";
import { cn } from "@/lib/utils";

export const HABIT_ICONS: Record<HabitIconName, LucideIcon> = {
  circle: Circle,
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  droplet: Droplet,
  footprints: Footprints,
  moon: Moon,
  "pen-line": PenLine,
  brain: Brain,
  apple: Apple,
  bike: Bike,
  music: Music,
  code: Code,
  leaf: Leaf,
  heart: Heart,
  sun: Sun,
  pill: Pill,
};

export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const Icon = HABIT_ICONS[name as HabitIconName] ?? Circle;
  return <Icon className={cn("size-4", className)} aria-hidden />;
}

/** Square tile tinted with the habit colour. */
export function HabitIconTile({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <HabitIcon name={name} />
    </span>
  );
}
