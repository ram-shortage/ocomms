/**
 * ARIA Compliance Tests
 *
 * Tests ARIA attributes and accessibility compliance using axe-core.
 * Validates key components pass automated accessibility checks.
 */

import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Extend expect with axe matchers
expect.extend(toHaveNoViolations);

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/test-workspace/channels/general",
}));

// Mock socket client
vi.mock("@/lib/socket-client", () => ({
  useSocket: () => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

// Mock the unread hook
vi.mock("@/lib/hooks/use-unread", () => ({
  useUnreadCounts: () => ({
    channelUnreads: {},
    isLoading: false,
  }),
}));

// Mock PWA online status
vi.mock("@/lib/pwa/use-online-status", () => ({
  useOnlineStatus: () => ({ isOnline: true }),
}));

// Mock cache functions
vi.mock("@/lib/cache", () => ({
  cacheMessage: vi.fn(),
  cacheMessages: vi.fn(),
  updateMessageDeletion: vi.fn(),
  useCachedChannelMessages: () => [],
  useCachedConversationMessages: () => [],
  useSendQueue: () => [],
  processQueue: vi.fn(),
}));

// Mock send message hook
vi.mock("@/hooks/use-send-message", () => ({
  useSendMessage: () => ({
    sendMessage: vi.fn(),
    isOnline: true,
  }),
}));

// Import components after mocks
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

describe("ARIA Compliance", () => {
  describe("Button component", () => {
    it("has no accessibility violations", async () => {
      const { container } = render(<Button>Click me</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("disabled buttons have proper ARIA attributes", async () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const button = screen.getByRole("button", { name: /disabled/i });
      expect(button).toBeDisabled();
    });

    it("icon buttons with sr-only labels are accessible", async () => {
      const { container } = render(
        <Button>
          <svg aria-hidden="true" />
          <span className="sr-only">Send message</span>
        </Button>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
    });
  });

  describe("Input component", () => {
    it("has no accessibility violations with label", async () => {
      const { container } = render(
        <div>
          <label htmlFor="test-input">Email address</label>
          <Input id="test-input" type="email" placeholder="Enter email" />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("input with aria-label is accessible", async () => {
      const { container } = render(
        <Input aria-label="Search messages" placeholder="Search..." />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      expect(screen.getByRole("textbox", { name: /search messages/i })).toBeInTheDocument();
    });

    it("required inputs have proper attributes", async () => {
      const { container } = render(
        <div>
          <label htmlFor="required-input">Username</label>
          <Input id="required-input" required aria-required="true" />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Textarea component", () => {
    it("has no accessibility violations with label", async () => {
      const { container } = render(
        <div>
          <label htmlFor="message-input">Message</label>
          <Textarea id="message-input" placeholder="Type a message..." />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("textarea with aria-label is accessible", async () => {
      const { container } = render(
        <Textarea aria-label="Compose message" placeholder="Type here..." />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      expect(screen.getByRole("textbox", { name: /compose message/i })).toBeInTheDocument();
    });
  });

  describe("Dialog component", () => {
    it("closed dialog has no accessibility violations", async () => {
      const { container } = render(
        <Dialog open={false}>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>This is a test dialog</DialogDescription>
            </DialogHeader>
            <p>Dialog content</p>
          </DialogContent>
        </Dialog>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("open dialog has accessible title", async () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a channel</DialogTitle>
              <DialogDescription>
                Channels are where conversations happen
              </DialogDescription>
            </DialogHeader>
            <p>Dialog body</p>
          </DialogContent>
        </Dialog>
      );

      // Dialog should have the title
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Create a channel")).toBeInTheDocument();
    });

    it("dialog close button has accessible name", async () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
            </DialogHeader>
            <p>Content</p>
          </DialogContent>
        </Dialog>
      );

      // The close button should have sr-only text "Close"
      expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
    });
  });

  describe("sr-only pattern for icon buttons", () => {
    it("all icon-only buttons should have accessible names", () => {
      // Render multiple icon buttons
      render(
        <div>
          <Button>
            <svg aria-hidden="true" data-testid="delete-icon" />
            <span className="sr-only">Delete message</span>
          </Button>
          <Button>
            <svg aria-hidden="true" data-testid="reply-icon" />
            <span className="sr-only">Reply in thread</span>
          </Button>
          <Button>
            <svg aria-hidden="true" data-testid="reaction-icon" />
            <span className="sr-only">Add reaction</span>
          </Button>
        </div>
      );

      // All buttons should be accessible by their sr-only names
      expect(screen.getByRole("button", { name: /delete message/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reply in thread/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add reaction/i })).toBeInTheDocument();
    });
  });

  describe("form accessibility", () => {
    it("form with proper fieldset and legend is accessible", async () => {
      const { container } = render(
        <form>
          <fieldset>
            <legend>Channel Settings</legend>
            <div>
              <label htmlFor="channel-name">Channel name</label>
              <Input id="channel-name" />
            </div>
            <div>
              <label htmlFor="channel-desc">Description</label>
              <Textarea id="channel-desc" />
            </div>
          </fieldset>
          <Button type="submit">Save</Button>
        </form>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("error messages are associated with inputs", async () => {
      const { container } = render(
        <div>
          <label htmlFor="email-input">Email</label>
          <Input
            id="email-input"
            aria-invalid="true"
            aria-describedby="email-error"
          />
          <span id="email-error" role="alert">
            Please enter a valid email
          </span>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Error message should be accessible
      expect(screen.getByRole("alert")).toHaveTextContent(/please enter a valid email/i);
    });
  });

  describe("list semantics", () => {
    it("navigation lists use proper semantics", async () => {
      const { container } = render(
        <nav aria-label="Channel navigation">
          <ul role="list">
            <li>
              <a href="/channel/general">general</a>
            </li>
            <li>
              <a href="/channel/random">random</a>
            </li>
          </ul>
        </nav>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      expect(screen.getByRole("navigation", { name: /channel navigation/i })).toBeInTheDocument();
      expect(screen.getByRole("list")).toBeInTheDocument();
    });
  });

  describe("interactive element states", () => {
    it("buttons correctly indicate loading state", async () => {
      const { container } = render(
        <Button disabled aria-busy="true">
          <span className="sr-only">Loading</span>
          Creating...
        </Button>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
    });

    it("toggle buttons indicate pressed state", async () => {
      const { container } = render(
        <Button aria-pressed="true">Bold</Button>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
    });
  });
});
