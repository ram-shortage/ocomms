"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface NoteViewerProps {
  /** Markdown content to render */
  content: string;
}

/**
 * Read-only markdown renderer for notes.
 * Uses react-markdown for XSS-safe rendering (no dangerouslySetInnerHTML).
 */
export function NoteViewer({ content }: NoteViewerProps) {
  return (
    <div className="prose dark:prose-invert prose-sm max-w-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        // Block javascript: URLs for security
        urlTransform={(url) => {
          if (url.startsWith("javascript:")) return "";
          return url;
        }}
        components={{
          // Open external links in new tab
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {content || "*No content yet*"}
      </Markdown>
    </div>
  );
}
