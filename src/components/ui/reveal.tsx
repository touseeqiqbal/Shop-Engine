"use client";
import { m as motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Fades & slides children in when they scroll into view. `instant`: content that is on screen when the page opens –
 * shown straight away (an invisible start would wait for the page's JavaScript and delay the first paint on phones).
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
  instant = false,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
  instant?: boolean;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce || instant ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}
