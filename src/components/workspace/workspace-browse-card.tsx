"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import Image from "next/image";

interface WorkspaceBrowseCardProps {
  workspace: {
    id: string;
    name: string;
    slug: string | null;
    logo: string | null;
    description: string | null;
    memberCount: number;
    joinPolicy: string;
  };
  isPending: boolean;
  onJoin: () => void;
  onRequest: () => void;
}

export function WorkspaceBrowseCard({
  workspace,
  isPending,
  onJoin,
  onRequest,
}: WorkspaceBrowseCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Workspace Logo */}
          <div className="flex-shrink-0">
            {workspace.logo ? (
              <Image
                src={workspace.logo}
                alt={workspace.name}
                width={40}
                height={40}
                className="rounded-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold text-lg">
                  {workspace.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Workspace Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1">{workspace.name}</h3>
            {workspace.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {workspace.description}
              </p>
            )}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {workspace.memberCount}{" "}
                {workspace.memberCount === 1 ? "member" : "members"}
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex-shrink-0">
            {isPending ? (
              <Button variant="outline" disabled>
                Request Pending
              </Button>
            ) : workspace.joinPolicy === "open" ? (
              <Button onClick={onJoin}>Join</Button>
            ) : workspace.joinPolicy === "request" ? (
              <Button onClick={onRequest} variant="secondary">
                Request to Join
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Invite Only
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
