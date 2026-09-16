"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import { MovingBorder } from "@/components/ui/aceternity";

/** Hoisted so a re-render cannot restart the breathing loop mid-cycle. */
const BREATHE = { opacity: [1, 0.88, 1] };
const STILL = { opacity: 1 };

/**
 * "Resume practice" CTA (§2.7).
 *
 * Wrapped in MovingBorder with an animated white light runner and a 2.5s
 * breathing cycle, stopping the moment the pointer or keyboard focus lands.
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
      <MovingBorder as="div" borderRadius="0.5rem" duration={2500}>
        <Link
          href="/practice"
          className="relative inline-flex items-center gap-2 rounded-btn bg-fg px-4 py-2 text-xs font-semibold text-surface-0 shadow-sm transition-all hover:opacity-90"
        >
          <Play className="h-3.5 w-3.5 fill-surface-0" aria-hidden="true" />
          {label}
        </Link>
      </MovingBorder>
    </motion.div>
  );
}
