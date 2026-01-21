"use client";

import { useState, useMemo } from "react";
import { formatDistanceToNow, format, differenceInDays, addDays } from "date-fns";
import { Search, Calendar, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { GuestBadge } from "./guest-badge";
import { removeGuestAccess, extendGuestExpiration } from "@/lib/actions/guest";

interface Guest {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: Date;
  guestExpiresAt: Date | null;
  guestSoftLocked: boolean | null;
  channels: Array<{ id: string; name: string; slug: string }>;
  isExpired: boolean;
}

interface GuestListProps {
  guests: Guest[];
  workspaceSlug: string;
  onGuestRemoved?: () => void;
  onGuestUpdated?: () => void;
}

type GuestStatus = "active" | "expiring-soon" | "expired";

function getGuestStatus(guest: Guest): GuestStatus {
  if (guest.guestSoftLocked) return "expired";
  if (!guest.guestExpiresAt) return "active";

  const daysUntilExpiry = differenceInDays(new Date(guest.guestExpiresAt), new Date());
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 7) return "expiring-soon";
  return "active";
}

function StatusBadge({ status }: { status: GuestStatus }) {
  const styles = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "expiring-soon": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const labels = {
    active: "Active",
    "expiring-soon": "Expiring Soon",
    expired: "Expired",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function GuestList({ guests, workspaceSlug, onGuestRemoved, onGuestUpdated }: GuestListProps) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [extendPopoverOpen, setExtendPopoverOpen] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const filteredGuests = useMemo(() => {
    if (!search.trim()) return guests;
    const searchLower = search.toLowerCase();
    return guests.filter(
      (guest) =>
        guest.user.name?.toLowerCase().includes(searchLower) ||
        guest.user.email.toLowerCase().includes(searchLower)
    );
  }, [guests, search]);

  const handleRemove = async () => {
    if (!selectedGuest) return;
    setLoading(selectedGuest.id);
    try {
      await removeGuestAccess(selectedGuest.id);
      onGuestRemoved?.();
    } catch (error) {
      console.error("Failed to remove guest:", error);
    } finally {
      setLoading(null);
      setRemoveDialogOpen(false);
      setSelectedGuest(null);
    }
  };

  const handleExtend = async (guestId: string) => {
    if (!selectedDate) return;
    setLoading(guestId);
    try {
      await extendGuestExpiration(guestId, selectedDate);
      onGuestUpdated?.();
    } catch (error) {
      console.error("Failed to extend guest expiration:", error);
    } finally {
      setLoading(null);
      setExtendPopoverOpen(null);
      setSelectedDate(undefined);
    }
  };

  const handleClearExpiration = async (guestId: string) => {
    setLoading(guestId);
    try {
      await extendGuestExpiration(guestId, null);
      onGuestUpdated?.();
    } catch (error) {
      console.error("Failed to clear guest expiration:", error);
    } finally {
      setLoading(null);
    }
  };

  if (guests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No guests in this workspace</p>
        <p className="text-sm mt-1">Create an invite link to add guests</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Guest table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 text-sm font-medium">Guest</th>
              <th className="text-left px-4 py-2 text-sm font-medium">Channels</th>
              <th className="text-left px-4 py-2 text-sm font-medium">Expires</th>
              <th className="text-left px-4 py-2 text-sm font-medium">Status</th>
              <th className="text-right px-4 py-2 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredGuests.map((guest) => {
              const status = getGuestStatus(guest);
              return (
                <tr key={guest.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                        {(guest.user.name?.[0] || guest.user.email[0]).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {guest.user.name || guest.user.email}
                          </span>
                          <GuestBadge size="sm" />
                        </div>
                        <p className="text-xs text-muted-foreground">{guest.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {guest.channels.slice(0, 3).map((ch) => (
                        <span
                          key={ch.id}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted"
                        >
                          #{ch.name}
                        </span>
                      ))}
                      {guest.channels.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{guest.channels.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {guest.guestExpiresAt ? (
                      <span title={format(new Date(guest.guestExpiresAt), "PPP")}>
                        {formatDistanceToNow(new Date(guest.guestExpiresAt), { addSuffix: true })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No expiration</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={loading === guest.id}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Popover
                          open={extendPopoverOpen === guest.id}
                          onOpenChange={(open) => {
                            setExtendPopoverOpen(open ? guest.id : null);
                            if (open) {
                              // Default to 30 days from now or current expiration
                              setSelectedDate(
                                guest.guestExpiresAt
                                  ? addDays(new Date(guest.guestExpiresAt), 30)
                                  : addDays(new Date(), 30)
                              );
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Extend Access
                            </DropdownMenuItem>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <div className="p-3 border-b">
                              <p className="text-sm font-medium">Set new expiration date</p>
                            </div>
                            <CalendarComponent
                              mode="single"
                              selected={selectedDate}
                              onSelect={setSelectedDate}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                            <div className="p-3 border-t flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExtendPopoverOpen(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleExtend(guest.id)}
                                disabled={!selectedDate}
                              >
                                Extend
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                        {guest.guestExpiresAt && (
                          <DropdownMenuItem onClick={() => handleClearExpiration(guest.id)}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Remove Expiration
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => {
                            setSelectedGuest(guest);
                            setRemoveDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Guest
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Remove confirmation dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Guest</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">
                {selectedGuest?.user.name || selectedGuest?.user.email}
              </span>{" "}
              from this workspace? They will lose access to all channels.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={loading === selectedGuest?.id}
            >
              {loading === selectedGuest?.id ? "Removing..." : "Remove Guest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
