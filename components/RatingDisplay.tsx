import { Star } from "lucide-react";

interface RatingDisplayProps {
  average: number;
  count: number;
}

export default function RatingDisplay({ average, count }: RatingDisplayProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Star size={14} className="fill-amber text-amber" />
      <span className="text-xs text-body-text font-medium">{average.toFixed(1)}</span>
      <span className="text-xs text-muted-text">({count})</span>
    </div>
  );
}
