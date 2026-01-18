"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/search/search-input";

interface SearchInputClientProps {
  workspaceSlug: string;
  initialQuery: string;
}

export function SearchInputClient({
  workspaceSlug,
  initialQuery,
}: SearchInputClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSearch = (query: string) => {
    startTransition(() => {
      if (query) {
        router.push(`/${workspaceSlug}/search?q=${encodeURIComponent(query)}`);
      } else {
        router.push(`/${workspaceSlug}/search`);
      }
    });
  };

  return (
    <SearchInput
      initialQuery={initialQuery}
      onSearch={handleSearch}
      isLoading={isPending}
    />
  );
}
