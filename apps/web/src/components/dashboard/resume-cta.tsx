"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import { buttonStyles } from "@/components/ui";

/** Hoisted so a re-render cannot restart the breathing loop mid-cycle. */
const BREATHE = { opacity: [1, 0.85, 1] };
const STILL = { opacity: 1 };

/**
 * "Resume practice" CTA (§2.7).
 *
 * Breathes on a 2.5s cycle to draw the eye without being obnoxious, and the
 * loop stops the moment the pointer or keyboard focus lands on it — so it
 * never fights someone who has already decided to click. Hovering the wrapper
 * also catches focus, because React's focus events bubble from the anchor.
 */
export function ResumePracticeCta({ label = "Resume practice" }: { label?: string }) {
  const reduced = useReducedMotion();
  const [engaged, setEngaged] = useState(false);
  const breathing = !reduced && !engaged;

  return (
    <motion.div
      animate={breathing ? BREATHE : STILL}
      transition={
        breathing ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }
      }
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      className="inline-flex"
    >
      <Link href="/practice" className={buttonStyles("primary", "md", "gap-2")}>
        <Play className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </Link>
    </motion.div>
  );
}
