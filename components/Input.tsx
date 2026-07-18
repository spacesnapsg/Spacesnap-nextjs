import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded h-11 px-4 focus:outline-none focus:border-user-teal-start transition-colors ${className}`}
        {...props}
      />
    );
  }
);

export default Input;
