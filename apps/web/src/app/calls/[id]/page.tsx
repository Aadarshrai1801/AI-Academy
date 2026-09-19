"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CallRoomRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/messages");
  }, [router]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="font-mono text-sm text-fg-muted">
        Calling features have transitioned to Personalized Direct Messages. Redirecting…
      </div>
    </div>
  );
}
