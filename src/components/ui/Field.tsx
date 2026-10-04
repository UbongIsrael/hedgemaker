import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactNode } from "react";

type FieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

export type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
  required?: boolean;
};

export function Field({ label, hint, error, htmlFor, className = "", children, required }: FieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const child = isValidElement<FieldControlProps>(children) ? children : null;
  const childDescription = [
    child?.props["aria-describedby"],
    hintId,
    errorId,
  ].filter(Boolean).join(" ") || undefined;
  const control = child
    ? cloneElement(child, {
        id: child.props.id ?? controlId,
        "aria-describedby": childDescription,
        "aria-invalid": error ? true : child.props["aria-invalid"],
        "aria-required": required ? true : child.props["aria-required"],
      })
    : children;
  return (
    <div className={["hm-field", error && "hm-field--invalid", className].filter(Boolean).join(" ")}>
      <label className="hm-field__label" htmlFor={controlId}>
        {label}{required && <span aria-hidden="true" className="hm-field__required"> *</span>}
      </label>
      {control}
      {hint && <div className="hm-field__hint" id={hintId}>{hint}</div>}
      {error && <div className="hm-field__error" id={errorId} role="alert">{error}</div>}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ className = "", invalid = false, "aria-describedby": describedBy, ...props }: InputProps) {
  return (
    <input
      className={["hm-input", invalid && "hm-input--invalid", className].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );
}
