"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export function ConnectButton({ schoolId, label }: { schoolId: Id<"schools">; label: string }) {
  const complete = useAction(api.whatsappIntegration.completeEmbeddedSignup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wabaIdRef = useRef<string | null>(null);
  const codeRef = useRef<string | null>(null);

  async function maybeComplete() {
    if (!wabaIdRef.current || !codeRef.current) return;
    setBusy(true);
    setError(null);
    const res = await complete({ schoolId, code: codeRef.current, wabaId: wabaIdRef.current });
    setBusy(false);
    wabaIdRef.current = null;
    codeRef.current = null;
    if (!res.ok) setError(res.error ?? "Connection failed");
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.origin !== "string" || !event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          wabaIdRef.current = data.data.waba_id;
          void maybeComplete();
        }
      } catch {
        /* non-JSON messages from the SDK are expected; ignore */
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const launch = () => {
    setError(null);
    window.FB?.login(
      (response: any) => {
        if (response?.authResponse?.code) {
          codeRef.current = response.authResponse.code;
          void maybeComplete();
        }
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { feature: "whatsapp_embedded_signup", sessionInfoVersion: "3" },
      },
    );
  };

  return (
    <div className="space-y-2">
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="lazyOnload"
        onLoad={() => window.FB?.init({ appId: process.env.NEXT_PUBLIC_META_APP_ID, version: "v22.0", xfbml: false })}
      />
      <Button variant="primary" onClick={launch} loading={busy} disabled={busy}>
        {label}
      </Button>
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}
