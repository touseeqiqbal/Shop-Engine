"use client";
import { AnimatePresence, m as motion } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useUi } from "@/store/ui";

export function Toaster() {
  const { toasts, dismiss } = useUi();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            className="glass pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-xl"
          >
            {t.tone === "error" ? (
              <XCircle className="size-4 text-rose-400" aria-hidden="true" />
            ) : t.tone === "info" ? (
              <Info className="size-4 text-sky-400" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
            )}
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
