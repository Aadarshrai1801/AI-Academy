"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
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
export function ResumePracticeCta({ label = "Resume Practice" }: { label?: string }) {
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
          className="relative inline-flex items-center rounded-btn bg-brand px-4 py-2 font-mono text-xs font-semibold text-on-brand shadow-sm transition-all hover:bg-brand-strong"
        >
          {label}
        </Link>
      </MovingBorder>
    </motion.div>
  );
}
