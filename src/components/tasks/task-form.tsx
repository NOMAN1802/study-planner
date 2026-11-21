"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Fieldset } from "@/components/ui/fieldset";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  TASK_CATEGORIES,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskFieldErrors,
  taskFormValues,
  taskSchema,
  type TaskFieldErrors,
  type TaskFormState,
  type TaskPriority,
  type TaskStatus,
} from "@/schemas/task";

export type TaskFormDefaults = {
  title: string;
  note: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** datetime-local value in the user's timezone, or "" */
  dueLocal: string;
  targetMinutes: number | null;
  habitId: string | null;
  category?: "GENERAL" | "OFFICE" | "STUDY";
};

const EMPTY: TaskFormDefaults = {
  title: "",
  note: null,
  status: "TODO",
  priority: "MEDIUM",
  dueLocal: "",
  targetMinutes: null,
  habitId: null,
};

type TaskFormProps = {
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  habits: { id: string; name: string }[];
  timezone: string;
  defaults?: TaskFormDefaults;
  submitLabel: string;
};

const chip =
  "inline-flex h-9 items-center justify-center rounded-sm border border-border bg-surface px-3 text-sm text-fg-muted transition-colors duration-150 hover:border-border-strong has-checked:border-fg/50 has-checked:bg-surface-2 has-checked:font-medium has-checked:text-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

export function TaskForm({
  action,
  habits,
  timezone,
  defaults = EMPTY,
  submitLabel,
}: TaskFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<TaskFieldErrors>();
  const errors = clientErrors ?? state.fieldErrors ?? {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = taskSchema.safeParse(taskFormValues(new FormData(event.currentTarget)));
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(taskFieldErrors(parsed.error));
      return;
    }
    setClientErrors(undefined);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {state.error ? (
        <p
          role="alert"
          className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Field id="title" label="Title" error={errors.title}>
        <Input
          id="title"
          name="title"
          defaultValue={defaults.title}
          maxLength={120}
          placeholder="e.g. Draft the quarterly report"
          invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "title-error" : undefined}
        />
      </Field>

      {defaults.category === "STUDY" ? null : (
        <Fieldset id="category" legend="Category" error={errors.category}>
          <div className="grid grid-cols-2 gap-2 sm:w-1/2">
            {TASK_CATEGORIES.map((c) => (
              <label key={c} className={chip}>
                <input
                  type="radio"
                  name="category"
                  value={c}
                  defaultChecked={(defaults.category ?? "GENERAL") === c}
                  className="sr-only"
                />
                {CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
        </Fieldset>
      )}

      <Fieldset id="priority" legend="Priority" error={errors.priority}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TASK_PRIORITIES.map((p) => (
            <label key={p} className={chip}>
              <input
                type="radio"
                name="priority"
                value={p}
                defaultChecked={defaults.priority === p}
                className="sr-only"
              />
              {PRIORITY_LABEL[p]}
            </label>
          ))}
        </div>
      </Fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="status" label="Status" error={errors.status}>
          <Select
            id="status"
            name="status"
            defaultValue={defaults.status}
            invalid={Boolean(errors.status)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="dueAt"
          label="Due"
          error={errors.dueAt}
          hint={`Optional. ${timezone.replaceAll("_", " ")} time.`}
        >
          <Input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            defaultValue={defaults.dueLocal}
            invalid={Boolean(errors.dueAt)}
            aria-describedby={errors.dueAt ? "dueAt-error" : "dueAt-hint"}
          />
        </Field>
        <Field
          id="targetMinutes"
          label="Target minutes"
          error={errors.targetMinutes}
          hint="Optional time budget"
        >
          <Input
            id="targetMinutes"
            name="targetMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={defaults.targetMinutes ?? ""}
            invalid={Boolean(errors.targetMinutes)}
            aria-describedby={errors.targetMinutes ? "targetMinutes-error" : "targetMinutes-hint"}
          />
        </Field>
        <Field
          id="habitId"
          label="Linked habit"
          error={errors.habitId}
          hint={
            habits.length
              ? "Focus time on this task will count toward the habit."
              : "No active habits yet"
          }
        >
          <Select
            id="habitId"
            name="habitId"
            defaultValue={defaults.habitId ?? ""}
            disabled={habits.length === 0}
            invalid={Boolean(errors.habitId)}
          >
            <option value="">None</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field id="note" label="Note" error={errors.note}>
        <Textarea
          id="note"
          name="note"
          defaultValue={defaults.note ?? ""}
          maxLength={2000}
          rows={4}
          placeholder="Details and links"
          invalid={Boolean(errors.note)}
        />
      </Field>

      <div className={cn("flex items-center gap-2 border-t border-border pt-5")}>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <Link
          href={defaults.category === "OFFICE" ? "/work-station/office" : "/tasks"}
          className="inline-flex h-9 items-center rounded-sm px-4 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
