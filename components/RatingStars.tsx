"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface RatingStarsProps {
  initialRating?: number;
  onRate?: (rating: number) => void;
  size?: number;
}

export default function RatingStars({ initialRating = 0, onRate, size = 16 }: RatingStarsProps) {
  const [rating, setRating] = useState(initialRating);
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || rating);
        return (
          <button
            key={star}
            type="button"
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            className="p-0.5"
            onMouseEnter={() => setHovered(star)}
            onClick={() => {
              setRating(star);
              onRate?.(star);
            }}
          >
            <Star size={size} className={filled ? "fill-amber text-amber" : "text-muted-text"} />
          </button>
        );
      })}
    </div>
  );
}
