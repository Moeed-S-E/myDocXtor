"use client";

import * as React from "react";
import { Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Footer affordance: an "Install app" button when the browser offers a PWA
 * install prompt, plus an offline badge when the connection drops. Both are
 * progressive — they render nothing when not applicable.
 */
export function InstallOffline() {
  const promptRef = React.useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = React.useState(false);
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => setCanInstall(false);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const install = async () => {
    const evt = promptRef.current;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    promptRef.current = null;
    setCanInstall(false);
  };

  if (!canInstall && !offline) return null;
  return (
    <div className="flex items-center gap-3">
      {offline && (
        <span className="flex items-center gap-1 text-xs text-warning" title="You are offline">
          <WifiOff className="size-3.5" /> Offline — tools still work
        </span>
      )}
      {canInstall && (
        <Button variant="outline" size="sm" onClick={install}>
          <Download className="size-4" /> Install app
        </Button>
      )}
    </div>
  );
}
