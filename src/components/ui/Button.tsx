import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-green text-green-ink hover:brightness-110 active:brightness-95 disabled:opacity-50",
  secondary: "bg-card-2 text-ink hover:bg-line active:bg-line-strong disabled:opacity-50",
  outline: "border border-line-strong text-ink hover:bg-card-2 disabled:opacity-50",
  ghost: "text-ink-2 hover:bg-card-2 hover:text-ink disabled:opacity-50",
  danger: "bg-over-soft text-over hover:brightness-95 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-2xl gap-2",
  lg: "h-13 px-5 text-base rounded-2xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center font-medium transition-[background-color,filter,transform] active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
