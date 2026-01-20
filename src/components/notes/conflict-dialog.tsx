"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConflictDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Name of the person who edited the note */
  editedByName: string;
  /** Called when user chooses to keep their version */
  onKeepYours: () => void;
  /** Called when user chooses to keep the server version */
  onKeepTheirs: () => void;
}

/**
 * Dialog shown when a version conflict is detected on note save.
 * Allows user to choose between keeping their edits or the server's version.
 */
export function ConflictDialog({
  open,
  onClose,
  editedByName,
  onKeepYours,
  onKeepTheirs,
}: ConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Conflict Detected</DialogTitle>
          <DialogDescription>
            This note was edited by {editedByName} while you were editing.
            Choose which version to keep.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:flex-row">
          <Button variant="outline" onClick={onKeepTheirs}>
            Keep their version
          </Button>
          <Button onClick={onKeepYours}>Keep your version</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
