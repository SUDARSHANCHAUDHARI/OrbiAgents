import type { ButtonHTMLAttributes } from "react";

type PixelButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function PixelButton({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: PixelButtonVariant }) {
  return <button {...props} className={`pixel-button pixel-button--${variant} ${className}`.trim()} />;
}
