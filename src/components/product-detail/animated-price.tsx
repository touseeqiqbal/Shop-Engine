"use client";
import { useEffect } from "react";
import { m as motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useMoney } from "@/components/providers/locale";
import { cn } from "@/lib/utils";

/** Amount (store currency) that springs to its new value. Screen readers get the final value only. */
export function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const money = useMoney();
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 });
  const text = useTransform(spring, (v) => money(v));

  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);

  return (
    <span className={cn("tabular-nums", className)}>
      <motion.span aria-hidden="true">{text}</motion.span>
      <span className="sr-only">{money(value)}</span>
    </span>
  );
}
