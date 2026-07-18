import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, className = "", children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto px-4 py-6"
      onClick={onClose}
    >
      <div
        className={`relative w-full bg-card border border-border rounded-card my-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 text-muted-text hover:text-body-text transition-colors"
        >
          <X size={20} />
        </button>
        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-8">{children}</div>
      </div>
    </div>
  );
}
