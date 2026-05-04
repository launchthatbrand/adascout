"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "./lib/utils";

export type MarketingSlideMetric = {
  label: string;
  value: string;
};

export type MarketingSlide = {
  id: string;
  badge?: string;
  title: string;
  description?: string;
  points?: ReadonlyArray<string>;
  metrics?: ReadonlyArray<MarketingSlideMetric>;
  imageUrl?: string;
  /**
   * Controls text/overlay contrast against the slide background.
   * - "dark": assumes a darker image; uses white text + darker overlays
   * - "light": assumes a lighter image; uses black text + lighter overlays
   *
   * If omitted, we try to infer from the image URL (e.g. `*-light.*`).
   */
  tone?: "dark" | "light";
  ctaLabel?: string;
  ctaHref?: string;
  ctaTarget?: "_blank" | "_self";
};

export function MarketingSlides(props: {
  slides: ReadonlyArray<MarketingSlide>;
  className?: string;
  intervalMs?: number;
  autoPlay?: boolean;
  initialIndex?: number;
  backgroundImageUrl?: string;
  footerHint?: string;
  variant?: "panel" | "card" | "plain";
  density?: "comfortable" | "compact";
  showDots?: boolean;
}) {
  const {
    slides,
    className,
    intervalMs = 6500,
    autoPlay = true,
    initialIndex = 0,
    backgroundImageUrl,
    footerHint,
    variant = "panel",
    density = "comfortable",
    showDots = true,
  } = props;

  const reducedMotion = useReducedMotion();

  const safeSlides = React.useMemo(
    () => slides.filter((s): s is MarketingSlide => Boolean(s)),
    [slides],
  );
  const [index, setIndex] = React.useState(() => {
    const start = Number.isFinite(initialIndex) ? initialIndex : 0;
    if (safeSlides.length <= 0) return 0;
    return ((start % safeSlides.length) + safeSlides.length) % safeSlides.length;
  });

  React.useEffect(() => {
    if (safeSlides.length <= 0) return;
    setIndex((i) => {
      const next = Number.isFinite(i) ? i : 0;
      return next >= 0 && next < safeSlides.length ? next : 0;
    });
  }, [safeSlides.length]);

  React.useEffect(() => {
    if (!autoPlay) return;
    if (reducedMotion) return;
    if (safeSlides.length <= 1) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % safeSlides.length);
    }, Math.max(2500, intervalMs));
    return () => window.clearInterval(t);
  }, [autoPlay, intervalMs, reducedMotion, safeSlides.length]);

  // Preload the next image to avoid decode hitch during crossfade.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (safeSlides.length <= 1) return;
    const next = safeSlides[(index + 1) % safeSlides.length];
    const src = next?.imageUrl ?? backgroundImageUrl ?? null;
    if (!src) return;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }, [backgroundImageUrl, index, safeSlides]);

  const active = safeSlides[index] ?? safeSlides[0];
  if (!active) return null;

  const activeBg = active.imageUrl ?? backgroundImageUrl ?? null;
  const tone =
    active.tone ??
    (activeBg && /(^|[\/_-])light([\/_.-]|$)/i.test(activeBg) ? "light" : "dark");

  const toneClass = (classes: { dark: string; light: string }) =>
    tone === "light" ? classes.light : classes.dark;

  const containerClassName = cn(
    "relative h-full w-full overflow-hidden",
    variant === "panel" && "border-l border-border/30",
    variant === "card" && "rounded-2xl border border-border/30 bg-background/20",
    className,
  );

  const paddingClassName = density === "compact" ? "p-5" : "p-8";

  return (
    <div className={containerClassName}>
      {/* Background */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeBg ?? "gradient"}
            className="absolute inset-0"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 1.02 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          >
            {activeBg ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${activeBg})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(var(--tlp-accent-rgb)/0.22),transparent_55%)]" />
            )}
            <div
              className={cn(
                "absolute inset-0",
                toneClass({
                  dark: "bg-linear-to-tr from-black/70 via-black/35 to-black/10",
                  light: "bg-linear-to-tr from-white/85 via-white/55 to-white/20",
                }),
              )}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgb(var(--tlp-accent-rgb)/0.18),transparent_60%)]" />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={cn("relative flex h-full flex-col justify-between", paddingClassName)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            className="space-y-3"
            initial={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, y: 10, filter: "blur(6px)" }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            exit={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, y: -10, filter: "blur(6px)" }
            }
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {active.badge ? (
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur",
                  toneClass({
                    dark: "border-white/15 bg-black/20 text-white/80",
                    light: "border-black/10 bg-white/35 text-black/80",
                  }),
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    toneClass({ dark: "bg-emerald-400", light: "bg-emerald-600" }),
                  )}
                />
                {active.badge}
              </div>
            ) : null}

            <div
              className={cn(
                "font-semibold tracking-tight",
                density === "compact" ? "text-2xl" : "text-3xl",
                toneClass({ dark: "text-white", light: "text-black" }),
              )}
            >
              {active.title}
            </div>

            {active.description ? (
              <div
                className={cn(
                  "max-w-sm text-sm",
                  toneClass({ dark: "text-white/70", light: "text-black/70" }),
                )}
              >
                {active.description}
              </div>
            ) : null}

            {active.points && active.points.length > 0 ? (
              <ul
                className={cn(
                  "mt-3 space-y-2 text-sm",
                  toneClass({ dark: "text-white/75", light: "text-black/75" }),
                )}
              >
                {active.points.slice(0, 4).map((p: string) => (
                  <li key={p} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1 inline-block h-1.5 w-1.5 rounded-full",
                        toneClass({
                          dark: "bg-[rgb(var(--tlp-accent-rgb)/0.9)]",
                          light: "bg-[rgb(var(--tlp-accent-rgb)/0.95)]",
                        }),
                      )}
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {active.ctaHref && active.ctaLabel ? (
              <div className="pt-2">
                <a
                  href={active.ctaHref}
                  target={active.ctaTarget ?? "_self"}
                  rel={active.ctaTarget === "_blank" ? "noopener noreferrer" : undefined}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200 sm:text-sm"
                >
                  {active.ctaLabel}
                </a>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="space-y-4">
          {active.metrics && active.metrics.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {active.metrics.slice(0, 3).map((m: MarketingSlideMetric) => (
                <div
                  key={m.label}
                  className={cn(
                    "rounded-xl border p-3 text-center backdrop-blur",
                    toneClass({
                      dark: "border-white/15 bg-black/20",
                      light: "border-black/10 bg-white/35",
                    }),
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      toneClass({ dark: "text-white", light: "text-black" }),
                    )}
                  >
                    {m.value}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      toneClass({ dark: "text-white/65", light: "text-black/60" }),
                    )}
                  >
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Dots */}
          {safeSlides.length > 1 && showDots ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {safeSlides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn(
                      "h-1.5 w-4 rounded-full transition",
                      i === index
                        ? "bg-[rgb(var(--tlp-accent-rgb)/0.9)]"
                        : toneClass({
                            dark: "bg-white/25 hover:bg-white/35",
                            light: "bg-black/20 hover:bg-black/30",
                          }),
                    )}
                    onClick={() => setIndex(i)}
                    aria-label={`Show slide ${i + 1}`}
                    aria-current={i === index ? "true" : "false"}
                  />
                ))}
              </div>
              {footerHint ? (
                <div
                  className={cn(
                    "text-xs",
                    toneClass({ dark: "text-white/55", light: "text-black/55" }),
                  )}
                >
                  {footerHint}
                </div>
              ) : null}
            </div>
          ) : footerHint ? (
            <div
              className={cn(
                "text-xs",
                toneClass({ dark: "text-white/55", light: "text-black/55" }),
              )}
            >
              {footerHint}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

