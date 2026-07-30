/**
 * Utility helpers used across the UI layer.
 * Pure functions only — no React, no side effects.
 */

import { type ClassValue, clsx } from "clsx";

/**
 * Lightweight class-name composer.
 * We intentionally avoid pulling in `tailwind-merge` for the scaffold;
 * add it later if conditional Tailwind class collisions become an issue.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
