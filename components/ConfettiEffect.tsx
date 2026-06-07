"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

interface Props {
  rank: number;
}

export default function ConfettiEffect({ rank }: Props) {
  useEffect(() => {
    if (rank < 1 || rank > 3) return;

    const colors =
      rank === 1
        ? ["#ffd700", "#ffec6e", "#ffffff", "#00ff87"]
        : rank === 2
          ? ["#b8bcc8", "#d0d4e0", "#ffffff", "#9095a8"]
          : ["#cd7f32", "#e8a060", "#ffffff", "#b86820"];

    const count = rank === 1 ? 280 : rank === 2 ? 180 : 110;

    confetti({
      particleCount: count,
      spread: 110,
      origin: { y: 0.55 },
      colors,
      scalar: 1.25,
    });

    if (rank === 1) {
      setTimeout(
        () =>
          confetti({
            particleCount: 100,
            angle: 60,
            spread: 65,
            origin: { x: 0, y: 0.6 },
            colors,
          }),
        320,
      );
      setTimeout(
        () =>
          confetti({
            particleCount: 100,
            angle: 120,
            spread: 65,
            origin: { x: 1, y: 0.6 },
            colors,
          }),
        560,
      );
    }
  }, [rank]);

  return null;
}
