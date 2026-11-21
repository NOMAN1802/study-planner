"use client";

import Form from "next/form";
import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";
import { Select } from "@/components/ui/select";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  isDefaultFilters,
  type TaskFilters as Filters,
} from "@/schemas/task";

const DUE_LABEL = {
  all: "Any due date",
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  none: "No due date",
};
const SORT_LABEL = { due: "Due date", priority: "Priority", created: "Newest", title: "Title" };

function submit(e: ChangeEvent<HTMLSelectElement>) {
  e.currentTarget.form?.requestSubmit();
}

/** Label is a sibling (not a wrapper) so the select's accessible name is just the label. */
function FilterSelect({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: ReactNode;
}) {
  const id = `filter-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium text-fg-muted">
        {label}
      </label>
      <Select
        id={id}
        name={name}
        defaultValue={value}
        onChange={submit}
        className="h-8 w-auto min-w-0 text-sm"
      >
        {children}
      </Select>
    </div>
  );
}

/** GET form: works without JS; with JS, each change navigates immediately. */
export function TaskFilters({ filters }: { filters: Filters }) {
  return (
    <Form
      action="/tasks"
      replace
      scroll={false}
      className="flex flex-wrap items-end gap-2"
      aria-label="Filter tasks"
    >
      <FilterSelect name="status" label="Status" value={filters.status}>
        <option value="open">Open</option>
        <option value="all">All</option>
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect name="priority" label="Priority" value={filters.priority}>
        <option value="all">All</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect name="due" label="Due" value={filters.due}>
        {Object.entries(DUE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect name="sort" label="Sort" value={filters.sort}>
        {Object.entries(SORT_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </FilterSelect>
      <noscript>
        <button type="submit" className="h-8 rounded-sm border border-border px-3 text-sm">
          Apply
        </button>
      </noscript>
      {!isDefaultFilters(filters) ? (
        <Link
          href="/tasks"
          className="inline-flex h-8 items-center px-2 text-sm text-fg-muted hover:text-fg"
        >
          Reset
        </Link>
      ) : null}
    </Form>
  );
}
