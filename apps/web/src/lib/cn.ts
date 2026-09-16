import { twMerge } from "tailwind-merge";

type ClassValue = string | false | null | undefined | ClassValue[];

function flatten(inputs: ClassValue[], out: string[]): string[] {
  for (const input of inputs) {
    if (!input) continue;
    if (Array.isArray(input)) flatten(input, out);
    else out.push(input);
  }
  return out;
}

/**
 * Conditional class names + Tailwind conflict resolution.
 *
 * `twMerge` is the important half: it lets shared primitives expose a
 * `className` prop that can override their own defaults
 * (`<Button className="w-full">` beats an internal `w-auto`) without
 * specificity fights. Callers never need `!important`.
 *
 * Accepts nested arrays so variant maps can return `[base, conditional]`
 * without spreading into the call site.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(flatten(inputs, []).join(" "));
}
