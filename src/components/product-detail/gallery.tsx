"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, m as motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Expand, Play, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

type Slide = { kind: "image"; src: string; alt: string } | { kind: "video"; src: string; alt: string };

function youTubeId(url: string) {
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

const SWIPE = 60;

/** Product media: hover-zoom main image, thumbnails, swipe, keyboard arrows, fullscreen lightbox, optional video. */
export function ProductGallery({ images, alts, name, video }: { images: string[]; alts?: string[]; name: string; video?: string }) {
  const slides: Slide[] = [
    ...images.map((src, i) => ({ kind: "image" as const, src, alt: alts?.[i] || `${name} – image ${i + 1}` })),
    ...(video ? [{ kind: "video" as const, src: video, alt: `${name} – video` }] : []),
  ];
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const reduce = useReducedMotion();
  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      if (!count) return;
      const n = (next + count) % count;
      setDir(next > index ? 1 : -1);
      setIndex(n);
    },
    [count, index]
  );

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    else if ((e.key === "Enter" || e.key === " ") && slides[index]?.kind === "image") { e.preventDefault(); setLightbox(true); }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE || info.velocity.x < -400) go(index + 1);
    else if (info.offset.x > SWIPE || info.velocity.x > 400) go(index - 1);
  };

  if (!count) return <div className="card aspect-square w-full" aria-hidden="true" />;
  const current = slides[index];

  return (
    <div className="space-y-3">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`${name} images`}
        tabIndex={0}
        onKeyDown={onKey}
        className="group relative aspect-square w-full overflow-hidden rounded-[1.75rem] xl:aspect-[10/9] border border-border bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent outline-none focus-visible:ring-2 focus-visible:ring-violet-500 light:from-slate-100 light:to-white"
      >
        <div className="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 size-72 rounded-full bg-violet-500/20 blur-3xl" aria-hidden="true" />

        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            drag={count > 1 && current.kind === "image" ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={onDragEnd}
            className="absolute inset-0 touch-pan-y"
          >
            {current.kind === "image" ? (
              <ZoomImage slide={current} priority={index === 0} onOpen={() => setLightbox(true)} />
            ) : (
              <VideoPlayer src={current.src} title={current.alt} />
            )}
          </motion.div>
        </AnimatePresence>

        {current.kind === "image" && (
          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label="Open fullscreen image viewer"
            className="glass absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full transition hover:scale-105"
          >
            <Expand className="size-4.5" aria-hidden="true" />
          </button>
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous image"
              className="glass absolute left-3 top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 sm:grid"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next image"
              className="glass absolute right-3 top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 sm:grid"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            {/* Mobile dot indicators */}
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5 sm:hidden">
              {slides.map((s, i) => (
                <button
                  key={s.src + i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${s.kind === "video" ? "video" : `image ${i + 1}`}`}
                  aria-current={i === index}
                  className="grid h-6 min-w-6 place-items-center"
                >
                  <span className={cn("block h-1.5 rounded-full transition-all", i === index ? "w-5 bg-brand-gradient" : "w-1.5 bg-fg/30")} />
                </button>
              ))}
            </div>
          </>
        )}
        <p className="sr-only" aria-live="polite">
          {current.kind === "video" ? "Product video" : `Image ${index + 1} of ${images.length}`}
        </p>
      </div>

      {count > 1 && (
        <ul className="scrollbar-none hidden gap-2.5 overflow-x-auto p-1 sm:flex" aria-label="Choose image">
          {slides.map((s, i) => (
            <li key={s.src + i} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={s.kind === "video" ? "Play product video" : `Show image ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "relative grid size-20 place-items-center overflow-hidden rounded-2xl border bg-surface transition",
                  i === index ? "border-transparent ring-2 ring-violet-500" : "border-border hover:border-border-strong"
                )}
              >
                {s.kind === "image" ? (
                  <Image src={s.src} alt="" fill sizes="80px" className="object-contain p-1.5" />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full bg-brand-gradient text-white">
                    <Play className="size-4 fill-current" aria-hidden="true" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {lightbox && (
          <Lightbox
            slides={slides.filter((s): s is Extract<Slide, { kind: "image" }> => s.kind === "image")}
            start={current.kind === "image" ? index : 0}
            onClose={(i) => {
              setLightbox(false);
              setIndex(i);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Desktop: lens-style zoom that follows the cursor. Tap/click opens the lightbox. */
function ZoomImage({ slide, priority, onOpen }: { slide: Slide; priority: boolean; onOpen: () => void }) {
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);

  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse" || e.buttons) return setZoom(null);
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onPointerMove={onMove}
      onPointerLeave={() => setZoom(null)}
      onClick={(e) => {
        const d = down.current;
        // ignore the click that ends a swipe
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
        onOpen();
      }}
      aria-label={`${slide.alt} – open fullscreen`}
      className={cn("relative block size-full", zoom ? "cursor-zoom-in" : "cursor-pointer")}
    >
      <Image
        src={slide.src}
        alt={slide.alt}
        fill
        priority={priority}
        loading={priority ? undefined : "lazy"}
        draggable={false}
        sizes="(min-width: 1280px) 46vw, (min-width: 1024px) 50vw, 100vw"
        className="select-none object-contain p-6 transition-transform duration-200 ease-out sm:p-10"
        style={zoom ? { transform: "scale(2.2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
      />
    </button>
  );
}

function VideoPlayer({ src, title }: { src: string; title: string }) {
  const [play, setPlay] = useState(false);
  const yt = youTubeId(src);
  if (!yt) {
    return (
      <video src={src} controls playsInline preload="metadata" className="size-full bg-black object-contain" aria-label={title}>
        <track kind="captions" />
      </video>
    );
  }
  if (play) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="size-full border-0"
      />
    );
  }
  return (
    <button type="button" onClick={() => setPlay(true)} aria-label={`Play ${title}`} className="group/v relative block size-full bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover opacity-80" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-18 place-items-center rounded-full bg-brand-gradient text-white shadow-[0_10px_40px_-6px_rgba(139,92,246,0.8)] transition group-hover/v:scale-110">
          <Play className="size-7 fill-current" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function Lightbox({
  slides,
  start,
  onClose,
}: {
  slides: { src: string; alt: string }[];
  start: number;
  onClose: (index: number) => void;
}) {
  const [i, setI] = useState(Math.min(start, slides.length - 1));
  const [zoomed, setZoomed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const n = slides.length;

  const go = useCallback((next: number) => {
    setZoomed(false);
    setI(((next % n) + n) % n);
  }, [n]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose(i);
      else if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>("button");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go, onClose]);

  const slide = slides[i];

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-3 p-3 text-white sm:p-5">
        <p className="text-sm font-medium tabular-nums text-white/80" aria-live="polite">
          {i + 1} / {n}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            aria-label={zoomed ? "Zoom out" : "Zoom in"}
            aria-pressed={zoomed}
            className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
          >
            {zoomed ? <ZoomOut className="size-5" aria-hidden="true" /> : <ZoomIn className="size-5" aria-hidden="true" />}
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose(i)}
            aria-label="Close image viewer"
            className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={i + (zoomed ? "-z" : "")}
            initial={{ opacity: 0, scale: zoomed ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: zoomed ? 2.2 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            drag={zoomed ? true : n > 1 ? "x" : false}
            dragConstraints={zoomed ? { left: -400, right: 400, top: -400, bottom: 400 } : { left: 0, right: 0 }}
            dragElastic={zoomed ? 0.1 : 0.3}
            onDragEnd={(_, info) => {
              if (zoomed) return;
              if (info.offset.x < -SWIPE || info.velocity.x < -400) go(i + 1);
              else if (info.offset.x > SWIPE || info.velocity.x > 400) go(i - 1);
            }}
            onDoubleClick={() => setZoomed((z) => !z)}
            className={cn("absolute inset-0 touch-none", zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
          >
            <Image src={slide.src} alt={slide.alt} fill sizes="100vw" draggable={false} className="select-none object-contain p-4 sm:p-12" />
          </motion.div>
        </AnimatePresence>
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(i - 1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 z-10 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(i + 1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 z-10 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronRight className="size-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="flex justify-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {slides.map((s, k) => (
            <button
              key={s.src + k}
              type="button"
              onClick={() => go(k)}
              aria-label={`Show image ${k + 1}`}
              aria-current={k === i}
              className={cn(
                "relative size-14 overflow-hidden rounded-xl border bg-white/5 transition",
                k === i ? "border-transparent ring-2 ring-violet-400" : "border-white/15 opacity-60 hover:opacity-100"
              )}
            >
              <Image src={s.src} alt="" fill sizes="56px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
