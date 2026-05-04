"use client";

import { motion, stagger, useAnimate } from "motion/react";
import { useEffect, useMemo } from "react";

import { cn } from "../../lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
  textClassName,
  wordClassName,
  filter = true,
  duration = 0.5,
}: {
  words: string;
  className?: string;
  textClassName?: string;
  wordClassName?: string;
  filter?: boolean;
  duration?: number;
}) => {
  const [scope, animate] = useAnimate();
  const wordsArray = useMemo(() => words.split(" "), [words]);
  useEffect(() => {
    animate(
      "span",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration: duration ? duration : 1,
        delay: stagger(0.2),
      }
    );
  }, [animate, duration, filter, wordsArray.length]);

  const renderWords = () => {
    return (
      <motion.div ref={scope}>
        {wordsArray.map((word, idx) => {
          return (
            <motion.span
              key={word + idx}
              className={cn(
                "opacity-0",
                wordClassName ?? "text-black dark:text-white",
              )}
              style={{
                filter: filter ? "blur(10px)" : "none",
              }}
            >
              {word}{" "}
            </motion.span>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn(className)}>
      <div className="mt-4">
        <div
          className={cn(
            "text-2xl font-bold leading-snug tracking-wide",
            textClassName,
          )}
        >
          {renderWords()}
        </div>
      </div>
    </div>
  );
};
