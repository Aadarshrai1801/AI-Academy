"use client";

import { useState } from "react";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

/**
 * Age + Terms gate (COPPA/GDPR): the sign-up form is only rendered after the
 * user confirms they are 13+ and accepts the Terms and Privacy Policy.
 * Server-side consent records (Clerk webhook) are tracked in docs/COMPLIANCE.md.
 */
export default function SignUpPage() {
  const [confirmed, setConfirmed] = useState(false);
  const [checked, setChecked] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-6 py-12">
      {confirmed ? (
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      ) : (
        <div className="w-full rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6">
          <div className="font-mono text-xs text-[var(--tungsten)]">{"//"} ELIGIBILITY</div>
          <h1 className="mt-2 text-lg font-bold text-[var(--ink-chalk)]">Before you create an account</h1>
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-lead)]">
            AI Academy is for learners aged 13 and older. Please confirm the following to
            continue.
          </p>
          <label className="mt-5 flex items-start gap-3 text-xs leading-relaxed text-[var(--ink-chalk)]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--tungsten)]"
            />
            <span>
              I am 13 years or older and I agree to the{" "}
              <Link href="/terms" className="text-[var(--tungsten)] hover:underline">
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" className="text-[var(--tungsten)] hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <button
            onClick={() => setConfirmed(true)}
            disabled={!checked}
            className="mt-5 w-full rounded border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-2 font-mono text-xs font-semibold text-on-brand transition-opacity hover:bg-brand-strong disabled:opacity-40"
          >
            Continue to sign up
          </button>
          <p className="mt-4 text-center text-[11px] text-[var(--ink-lead)]">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-[var(--tungsten)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
