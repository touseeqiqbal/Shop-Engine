"use client";
import { useEffect, useState } from "react";

/** Plain-language toasts for every save / delete / error. Call toast("Saved") from any admin component. */
type Tone = "success" | "error" | "info";
type Item = { id: number; text: string; tone: Tone };
const EVENT = "urko:toast";

export function toast(text: string, tone: Tone = "success") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent<{ text: string; tone: Tone }>).detail;
      const id = ++n;
      setItems((list) => [...list.slice(-3), { id, text, tone }]);
      setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), tone === "error" ? 7000 : 3500);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div className="urko-toasts" role="status" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className={`urko-toast urko-toast--${i.tone}`}>
          <span aria-hidden="true">{i.tone === "success" ? "✓" : i.tone === "error" ? "!" : "i"}</span>
          {i.text}
        </div>
      ))}
    </div>
  );
}
