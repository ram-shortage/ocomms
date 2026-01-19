"use client";

import { PushSettingsPanel } from "@/components/push";

export function NotificationsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Notifications</h2>
      <PushSettingsPanel />
    </section>
  );
}
