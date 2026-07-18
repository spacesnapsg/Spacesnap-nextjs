import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-gradient-to-r from-user-teal-start to-user-teal-end text-white",
  ghost: "bg-card border border-border text-muted-text",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center h-11 px-5 rounded font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
