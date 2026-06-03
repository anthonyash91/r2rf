import * as React from "react";
import { cn } from "@/lib/utils";

const INPUT_CLASSES =
  "mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm";

interface LabeledInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Datalist suggestions. Renders a hidden <datalist> tied to the input. */
  suggestions?: string[];
  /** Optional helper / hint text rendered under the input. */
  description?: React.ReactNode;
  /** Extra classes appended to the input. */
  inputClassName?: string;
  /** Extra classes on the wrapping <label>. */
  className?: string;
}

/**
 * Standard labeled text input used across admin forms. Matches the project's
 * `px-4 py-2 text-sm` input control style.
 */
export function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  suggestions,
  description,
  inputClassName,
  className,
  ...rest
}: LabeledInputProps) {
  // Derive a stable datalist id from the label so the <input list> attribute
  // links correctly without needing an explicit id prop.
  const listId =
    suggestions && suggestions.length > 0
      ? `dl-${label.replace(/\s+/g, "-").toLowerCase()}`
      : undefined;
  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-medium">{label}</span>
      <input
        {...rest}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        className={cn(INPUT_CLASSES, inputClassName)}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </label>
  );
}

interface LabeledTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: React.ReactNode;
  inputClassName?: string;
  className?: string;
}

export function LabeledTextarea({
  label,
  value,
  onChange,
  rows = 3,
  description,
  inputClassName,
  className,
  ...rest
}: LabeledTextareaProps) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-medium">{label}</span>
      <textarea
        {...rest}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT_CLASSES, inputClassName)}
      />
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </label>
  );
}

interface LabeledFieldProps {
  label: string;
  children: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

/**
 * Wrapper that supplies the standard label markup around an arbitrary
 * control (Select, combobox, file uploader, etc.). Use when the input
 * isn't a plain <input>/<textarea>.
 */
export function LabeledField({ label, children, description, className }: LabeledFieldProps) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </label>
  );
}
