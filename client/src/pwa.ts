/**
 * Service worker registration. The install prompt is the PWAInstallButton component, which
 * listens for `beforeinstallprompt` itself.
 */
import { createElement } from "react";
import { toast } from "@/components/ui/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";

async function registerServiceWorker() {
  // Vite serves source files in development; a worker caching them would serve stale code.
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    registration.addEventListener("updatefound", () => {
      const next = registration.installing;
      next?.addEventListener("statechange", () => {
        // A controller already exists, so this is an update rather than the first install.
        if (next.state === "installed" && navigator.serviceWorker.controller) showUpdateToast();
      });
    });
  } catch (error) {
    console.error("Service worker registration failed:", error);
  }
}

function showUpdateToast() {
  toast({
    title: "A new version of Glas is ready",
    description: "Reload to get the latest changes.",
    duration: Infinity,
    action: createElement(
      ToastAction,
      { altText: "Reload to update", onClick: () => window.location.reload() },
      "Reload",
    ) as unknown as ToastActionElement,
  });
}

/** Registers the service worker. Called once from main.tsx. */
export function initializePWA() {
  registerServiceWorker();
}
