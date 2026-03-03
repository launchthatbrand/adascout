import { useCallback, useRef, useState } from "react";

export const useAnimationTrigger = (animationDuration: number) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerAnimation = useCallback((updateState: () => void) => {
        setIsAnimating(true);

        if (animationTimeoutRef.current) {
            clearTimeout(animationTimeoutRef.current);
        }

        animationTimeoutRef.current = setTimeout(() => {
            updateState();
            setIsAnimating(false);
        }, animationDuration);
    }, [animationDuration]);

    return { isAnimating, triggerAnimation };
};
