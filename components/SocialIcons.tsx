// Minimal inline brand glyphs — lucide-react dropped social icons in the
// version this repo uses, and pulling in a whole icon library (react-icons,
// simple-icons) for five static footer icons isn't worth the dependency.

type IconProps = { className?: string };

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.9.25-1.5 1.5-1.5H16.5V4.25C16.25 4.2 15.4 4 14.4 4 12.3 4 10.9 5.3 10.9 7.7V10.5H8.5v3h2.4V21h2.6z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LinkedinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4.98 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3.5 9h3v11.5h-3zM9.5 9h2.9v1.6h.04c.4-.76 1.4-1.6 2.9-1.6 3.1 0 3.66 2 3.66 4.7v6.8h-3v-6c0-1.44-.03-3.28-2-3.28-2 0-2.3 1.56-2.3 3.18v6.1h-3z" />
    </svg>
  );
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.6 7.2c-.24-1-1.02-1.77-2-2C17.9 4.75 12 4.75 12 4.75s-5.9 0-7.6.45c-.98.23-1.76 1-2 2C2 8.9 2 12 2 12s0 3.1.4 4.8c.24 1 1.02 1.77 2 2 1.7.45 7.6.45 7.6.45s5.9 0 7.6-.45c.98-.23 1.76-1 2-2 .4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.2V8.8l5.5 3.2z" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.9 10.7 20.2 3.5h-1.9l-5.4 6.2-4.5-6.2H3l6.6 9.1L3 21.5h1.9l5.7-6.6 4.8 6.6H21z" />
    </svg>
  );
}
