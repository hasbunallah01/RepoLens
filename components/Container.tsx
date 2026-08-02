import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Centered, max-width content wrapper.
 * Use for page sections to keep reading width consistent.
 */
export function Container({ children, className, ...rest }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
