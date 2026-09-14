import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      <p className="text-center text-[11px] text-[var(--ink-lead)]">
        By signing in you agree to the{" "}
        <Link href="/terms" className="text-[var(--tungsten)] hover:underline">
          Terms of Service
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="text-[var(--tungsten)] hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
