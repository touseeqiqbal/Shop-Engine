"use client";
import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "framer-motion";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

/**
 * Animations load after the page instead of in the first JavaScript bundle. Components import `m as motion`;
 * `strict` throws if a full `motion` component sneaks back in (it would pull everything into the bundle again).
 * `reducedMotion="user"`: shoppers whose device asks for less motion get no slides, springs or scaling (fades stay).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
