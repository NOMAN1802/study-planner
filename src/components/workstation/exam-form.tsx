"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteExam, recordExam } from "@/actions/workstation";
import { iconButton } from "@/components/workstation/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EXAM_KINDS, EXAM_LABEL, type ExamKind } from "@/schemas/workstation";

export type ExamPreset = { kind: ExamKind; day: string; subjectId: string | null };

export function ExamForm({
  subjects,
  preset,
}: {
  subjects: { id: string; name: string }[];
  preset: ExamPreset;
}) {
  const [state, action, pending] = useActionState(recordExam, {});
  const errors = state.fieldErrors ?? {};
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      action={action}
      noValidate
      aria-label="Record exam"
      className="flex flex-col gap-4"
    >
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="exam-kind" label="Exam" error={errors.kind}>
          <Select id="exam-kind" name="kind" defaultValue={preset.kind}>
            {EXAM_KINDS.map((k) => (
              <option key={k} value={k}>
                {EXAM_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="exam-day" label="Date" error={errors.day}>
          <Input
            id="exam-day"
            name="day"
            type="date"
            defaultValue={preset.day}
            invalid={Boolean(errors.day)}
          />
        </Field>
        <Field
          id="exam-subject"
          label="Subject"
          error={errors.subjectId}
          hint="Needed for a subject final."
        >
          <Select
            id="exam-subject"
            name="subjectId"
            defaultValue={preset.subjectId ?? ""}
            invalid={Boolean(errors.subjectId)}
            aria-describedby={errors.subjectId ? "exam-subject-error" : "exam-subject-hint"}
          >
            <option value="">All / mixed</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="exam-score" label="Score" error={errors.score}>
          <Input
            id="exam-score"
            name="score"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.25"
            invalid={Boolean(errors.score)}
          />
        </Field>
        <Field id="exam-total" label="Out of" error={errors.total}>
          <Input
            id="exam-total"
            name="total"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.25"
            invalid={Boolean(errors.total)}
          />
        </Field>
        <Field id="exam-note" label="Note" error={errors.note}>
          <Input id="exam-note" name="note" maxLength={500} placeholder="Weak areas, source…" />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Save result
        </Button>
        {state.ok ? (
          <span role="status" className="text-sm text-fg-muted">
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function DeleteExam({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={iconButton}
        disabled={pending}
        aria-label={`Delete ${label}`}
        onClick={() =>
          start(async () => {
            const r = await deleteExam(id);
            setError(r.error ?? null);
          })
        }
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
