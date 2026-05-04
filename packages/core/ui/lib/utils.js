import { cx } from "class-variance-authority";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs) => twMerge(cx(inputs));
