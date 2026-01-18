"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Hash, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SearchResult } from "@/lib/actions/search";

interface SearchResultsProps {
  results: SearchResult[];
  workspaceSlug: string;
  isLoading?: boolean;
  query: string;
}

export function SearchResults({
  results,
  workspaceSlug,
  isLoading = false,
  query,
}: SearchResultsProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="text-muted-foreground text-center py-8">
        Searching...
      </div>
    );
  }

  // Empty query state
  if (!query) {
    return (
      <div className="text-muted-foreground text-center py-8">
        Enter a search term to find messages
      </div>
    );
  }

  // No results state
  if (results.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No messages found for &quot;{query}&quot;
      </div>
    );
  }

  // Results list
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {results.length} result{results.length !== 1 ? "s" : ""} for &quot;{query}&quot;
      </p>
      {results.map((result) => {
        // Build link URL
        const href = result.channel
          ? `/${workspaceSlug}/channels/${result.channel.slug}`
          : `/${workspaceSlug}/dm/${result.conversationId}`;

        // Build context label
        const contextLabel = result.channel
          ? `#${result.channel.name}`
          : result.conversation?.isGroup
            ? "Group DM"
            : "Direct Message";

        // Truncate content if too long
        const displayContent =
          result.content.length > 200
            ? result.content.substring(0, 200) + "..."
            : result.content;

        return (
          <Link key={result.id} href={href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer py-3">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Author avatar */}
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium shrink-0">
                    {result.author.image ? (
                      <img
                        src={result.author.image}
                        alt={result.author.name}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      result.author.name[0]?.toUpperCase() || "?"
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {result.author.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(result.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    {/* Message content */}
                    <p className="text-sm text-foreground mt-1">
                      {displayContent}
                    </p>

                    {/* Context badge */}
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      {result.channel ? (
                        <Hash className="h-3 w-3" />
                      ) : (
                        <MessageSquare className="h-3 w-3" />
                      )}
                      <span>{contextLabel}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
