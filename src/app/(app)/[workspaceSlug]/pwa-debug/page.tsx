"use client";

import { useEffect, useState } from "react";

interface DebugInfo {
  isSecure: boolean;
  hasServiceWorker: boolean;
  swControlling: boolean;
  swState: string | null;
  manifestUrl: string | null;
  manifestValid: boolean;
  manifestContent: Record<string, unknown> | null;
  iconsAccessible: Record<string, boolean>;
  beforeInstallPromptFired: boolean;
  isStandalone: boolean;
  userAgent: string;
}

export default function PWADebugPage() {
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setDebug((prev) =>
        prev ? { ...prev, beforeInstallPromptFired: true } : prev
      );
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    async function runDiagnostics() {
      const info: DebugInfo = {
        isSecure: location.protocol === "https:",
        hasServiceWorker: "serviceWorker" in navigator,
        swControlling: !!navigator.serviceWorker?.controller,
        swState: navigator.serviceWorker?.controller?.state || null,
        manifestUrl: null,
        manifestValid: false,
        manifestContent: null,
        iconsAccessible: {},
        beforeInstallPromptFired: false,
        isStandalone:
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as Navigator & { standalone?: boolean })
            .standalone === true,
        userAgent: navigator.userAgent,
      };

      // Check manifest
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        info.manifestUrl = (manifestLink as HTMLLinkElement).href;
        try {
          const resp = await fetch(info.manifestUrl);
          if (resp.ok) {
            info.manifestContent = await resp.json();
            info.manifestValid = true;
          }
        } catch {
          info.manifestValid = false;
        }
      }

      // Check icons
      const iconUrls = [
        "/icons/icon-192x192.png",
        "/icons/icon-512x512.png",
        "/icons/icon-maskable-512x512.png",
      ];
      for (const url of iconUrls) {
        try {
          const resp = await fetch(url, { method: "HEAD" });
          info.iconsAccessible[url] = resp.ok;
        } catch {
          info.iconsAccessible[url] = false;
        }
      }

      // Check if beforeinstallprompt was already captured
      if ((window as Window & { deferredPrompt?: Event }).deferredPrompt) {
        info.beforeInstallPromptFired = true;
        setInstallPrompt(
          (window as Window & { deferredPrompt?: Event }).deferredPrompt!
        );
      }

      setDebug(info);
      setChecking(false);
    }

    runDiagnostics();

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt();
  };

  const getStatusIcon = (ok: boolean) => (ok ? "✅" : "❌");

  if (checking) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">PWA Diagnostics</h1>
        <p>Running diagnostics...</p>
      </div>
    );
  }

  if (!debug) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">PWA Diagnostics</h1>
        <p>Failed to load diagnostics</p>
      </div>
    );
  }

  const allPassed =
    debug.isSecure &&
    debug.hasServiceWorker &&
    debug.swControlling &&
    debug.manifestValid &&
    Object.values(debug.iconsAccessible).every(Boolean);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">PWA Installation Diagnostics</h1>

      <div className="space-y-4">
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Core Requirements</h2>
          <ul className="space-y-1 text-sm">
            <li>
              {getStatusIcon(debug.isSecure)} HTTPS: {debug.isSecure ? "Yes" : "No"}
            </li>
            <li>
              {getStatusIcon(debug.hasServiceWorker)} Service Worker API:{" "}
              {debug.hasServiceWorker ? "Available" : "Not available"}
            </li>
            <li>
              {getStatusIcon(debug.swControlling)} SW Controlling:{" "}
              {debug.swControlling ? `Yes (${debug.swState})` : "No"}
            </li>
            <li>
              {getStatusIcon(debug.manifestValid)} Manifest Valid:{" "}
              {debug.manifestValid ? "Yes" : "No"}
            </li>
          </ul>
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Icons</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(debug.iconsAccessible).map(([url, ok]) => (
              <li key={url}>
                {getStatusIcon(ok)} {url}
              </li>
            ))}
          </ul>
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Install Status</h2>
          <ul className="space-y-1 text-sm">
            <li>
              {getStatusIcon(debug.beforeInstallPromptFired)} beforeinstallprompt fired:{" "}
              {debug.beforeInstallPromptFired ? "Yes" : "No (Chrome may not consider installable)"}
            </li>
            <li>
              {getStatusIcon(!debug.isStandalone)} Already installed:{" "}
              {debug.isStandalone ? "Yes (running in standalone mode)" : "No"}
            </li>
          </ul>
        </section>

        {installPrompt && (
          <section className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
            <h2 className="font-semibold mb-2">Install Available!</h2>
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Install App
            </button>
          </section>
        )}

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Summary</h2>
          <p className="text-sm">
            {allPassed
              ? "All core requirements pass. If beforeinstallprompt hasn't fired, try: 1) Clear site data in Chrome settings, 2) Revisit the site, 3) Wait 30 seconds, 4) Check this page again."
              : "Some requirements are not met. See above for details."}
          </p>
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Manifest Content</h2>
          <pre className="text-xs overflow-x-auto bg-gray-100 dark:bg-gray-800 p-2 rounded">
            {JSON.stringify(debug.manifestContent, null, 2)}
          </pre>
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">User Agent</h2>
          <p className="text-xs break-all">{debug.userAgent}</p>
        </section>
      </div>
    </div>
  );
}
