/**
 * Preset statuses for quick selection (STAT-02)
 */
export const STATUS_PRESETS = [
  { key: "meeting", emoji: "📅", text: "In a meeting" },
  { key: "sick", emoji: "🤒", text: "Out sick" },
  { key: "vacation", emoji: "🌴", text: "On vacation" },
  { key: "focusing", emoji: "🎯", text: "Focusing" },
] as const;

export type StatusPreset = (typeof STATUS_PRESETS)[number];
