"use client";

interface StatusDisplayProps {
  emoji: string | null;
  text: string | null;
  showText?: boolean;
}

/**
 * Simple status display component showing emoji with optional text.
 * Used in message headers and member lists.
 */
export function StatusDisplay({ emoji, text, showText = false }: StatusDisplayProps) {
  // Don't render anything if no status
  if (!emoji && !text) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {emoji && (
        <span className="text-sm" title={text || undefined}>
          {emoji}
        </span>
      )}
      {showText && text && (
        <span className="text-xs text-muted-foreground truncate max-w-32">
          {text}
        </span>
      )}
    </span>
  );
}
