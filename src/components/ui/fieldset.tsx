import type { ReactNode } from "react";

type FieldsetProps = {
  id: string;
  legend: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

/** Group of related controls (radios / checkboxes) with an accessible legend. */
export function Fieldset({ id, legend, error, hint, children }: FieldsetProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={describedBy}>
      <legend className="mb-2 text-sm font-medium text-fg">{legend}</legend>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
