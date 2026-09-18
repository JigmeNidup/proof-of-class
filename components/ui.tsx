"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { classNames } from "@/lib/utils";

export function Panel({
  children,
  className,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={classNames(
        "rounded-2xl border border-ink-700 bg-ink-850/80 p-5 shadow-lg shadow-black/20 backdrop-blur",
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-white">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-ink-400">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary: "bg-brand-500 text-white hover:bg-brand-600",
    secondary:
      "border border-ink-600 bg-ink-800 text-ink-300 hover:border-ink-400 hover:text-white",
    ghost: "text-ink-300 hover:bg-ink-800 hover:text-white",
    danger: "bg-red-600/90 text-white hover:bg-red-600",
  } as const;

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  } as const;

  return (
    <button
      className={classNames(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={classNames(
        "inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-600 focus:border-brand-400 focus:outline-none";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={classNames(controlClass, props.className)} />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={classNames(controlClass, "min-h-20", props.className)}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={classNames(controlClass, props.className)} />
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "border-ink-600 bg-ink-800 text-ink-300",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    danger: "border-red-500/40 bg-red-500/10 text-red-300",
    info: "border-brand-400/40 bg-brand-400/10 text-brand-400",
  } as const;

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink-300">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-xs text-ink-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
}) {
  const tones = {
    info: "border-brand-400/40 bg-brand-400/10 text-brand-400",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    danger: "border-red-500/40 bg-red-500/10 text-red-200",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  } as const;

  return (
    <div
      className={classNames(
        "rounded-lg border px-3 py-2 text-sm",
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex rounded-lg border border-ink-700 bg-ink-900 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={classNames(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-brand-500 text-white"
              : "text-ink-400 hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
