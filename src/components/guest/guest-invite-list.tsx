"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Copy, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { revokeGuestInvite } from "@/lib/actions/guest";

interface GuestInvite {
  id: string;
  token: string;
  inviteUrl: string;
  channelIds: string[];
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: { id: string; name: string | null; email: string } | null;
  usedBy: { id: string; name: string | null; email: string } | null;
  usedAt: Date | null;
  isUsed: boolean;
  isExpired: boolean;
}

interface Channel {
  id: string;
  name: string;
}

interface GuestInviteListProps {
  invites: GuestInvite[];
  channels: Channel[];
  onInviteRevoked?: () => void;
}

function maskToken(token: string): string {
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function GuestInviteList({ invites, channels, onInviteRevoked }: GuestInviteListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<GuestInvite | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const channelMap = new Map(channels.map((ch) => [ch.id, ch.name]));

  const handleCopy = async (inviteUrl: string, inviteId: string) => {
    const baseUrl = window.location.origin;
    await navigator.clipboard.writeText(`${baseUrl}${inviteUrl}`);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async () => {
    if (!selectedInvite) return;
    setLoading(selectedInvite.id);
    try {
      await revokeGuestInvite(selectedInvite.id);
      onInviteRevoked?.();
    } catch (error) {
      console.error("Failed to revoke invite:", error);
    } finally {
      setLoading(null);
      setRevokeDialogOpen(false);
      setSelectedInvite(null);
    }
  };

  // Filter to only show unused invites
  const unusedInvites = invites.filter((inv) => !inv.isUsed);

  if (unusedInvites.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No pending invite links
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 text-sm font-medium">Token</th>
              <th className="text-left px-4 py-2 text-sm font-medium">Channels</th>
              <th className="text-left px-4 py-2 text-sm font-medium">Created</th>
              <th className="text-left px-4 py-2 text-sm font-medium">Expires</th>
              <th className="text-right px-4 py-2 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {unusedInvites.map((invite) => (
              <tr key={invite.id} className={`hover:bg-muted/30 ${invite.isExpired ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {maskToken(invite.token)}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {invite.channelIds.slice(0, 2).map((chId) => (
                      <span
                        key={chId}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted"
                      >
                        #{channelMap.get(chId) || "deleted"}
                      </span>
                    ))}
                    {invite.channelIds.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{invite.channelIds.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  <span title={invite.createdBy?.name || invite.createdBy?.email || ""}>
                    {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true })}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {invite.expiresAt ? (
                    <span
                      className={invite.isExpired ? "text-red-600 dark:text-red-400" : ""}
                      title={format(new Date(invite.expiresAt), "PPP")}
                    >
                      {invite.isExpired ? "Expired" : formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!invite.isExpired && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(invite.inviteUrl, invite.id)}
                        title="Copy invite link"
                      >
                        {copiedId === invite.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedInvite(invite);
                        setRevokeDialogOpen(true);
                      }}
                      disabled={loading === invite.id}
                      title="Revoke invite"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Revoke confirmation dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Invite</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this invite link? Anyone with the link
              will no longer be able to join.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={loading === selectedInvite?.id}
            >
              {loading === selectedInvite?.id ? "Revoking..." : "Revoke Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
