"use client";

import { AnimatePresence, motion } from "motion/react";
import React, { useCallback, useEffect, useState } from "react";

import { cn } from "../../lib/utils";

export const FlipWords = ({
  words,
  duration = 3000,
  className,
  wordClassName,
  letterClassName,
}: {
  words: string[];
  duration?: number;
  className?: string;
  wordClassName?: string;
  letterClassName?: string;
}) => {
  const safeWords = React.useMemo(() => (words.length > 0 ? words : [""]), [words]);
  const [currentWord, setCurrentWord] = useState<string>(safeWords[0] ?? "");
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // thanks for the fix Julian - https://github.com/Julian-AT
  const startAnimation = useCallback(() => {
    const word =
      safeWords[safeWords.indexOf(currentWord) + 1] ||
      safeWords[0] ||
      "";
    setCurrentWord(word);
    setIsAnimating(true);
  }, [currentWord, safeWords]);

  useEffect(() => {
    if (isAnimating) return;
    const t = window.setTimeout(() => startAnimation(), duration);
    return () => window.clearTimeout(t);
  }, [isAnimating, duration, startAnimation]);

  const wordParts = React.useMemo(() => currentWord.split(" "), [currentWord]);

  return (
    <AnimatePresence
      onExitComplete={() => {
        setIsAnimating(false);
      }}
    >
      <motion.div
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 10,
        }}
        exit={{
          opacity: 0,
          y: -40,
          x: 40,
          filter: "blur(8px)",
          scale: 2,
          position: "absolute",
        }}
        className={cn(
          "relative z-10 inline-block px-2 text-left",
          className
        )}
        key={currentWord}
      >
        {/* edit suggested by Sajal: https://x.com/DewanganSajal */}
        {wordParts.map((word, wordIndex) => (
          <motion.span
            key={word + wordIndex}
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              delay: wordIndex * 0.3,
              duration: 0.3,
            }}
            className={cn("inline-block whitespace-nowrap", wordClassName)}
          >
            {word.split("").map((letter, letterIndex) => (
              <motion.span
                key={word + letterIndex}
                initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  delay: wordIndex * 0.3 + letterIndex * 0.05,
                  duration: 0.2,
                }}
                className={cn("inline-block", letterClassName)}
              >
                {letter}
              </motion.span>
            ))}
            {wordIndex < wordParts.length - 1 ? (
            <span className="inline-block">&nbsp;</span>
            ) : null}
          </motion.span>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};
