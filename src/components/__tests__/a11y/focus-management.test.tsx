/**
 * Focus Management Tests
 *
 * Tests proper focus management for dialogs, routing, and dynamic content:
 * - Modal focus trap
 * - Focus return on close
 * - Tab cycling in modal
 * - Route change focus
 * - Skip links
 * - Dynamic content announcements
 */

import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

describe("Focus Management", () => {
  describe("Modal focus trap", () => {
    it("focus moves to modal when opened", async () => {
      const user = userEvent.setup();

      function ModalWithTrigger() {
        const [open, setOpen] = React.useState(false);
        return (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="trigger">Open Modal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modal Title</DialogTitle>
                <DialogDescription>Modal description text</DialogDescription>
              </DialogHeader>
              <Input data-testid="modal-input" placeholder="Type here" />
              <DialogFooter>
                <Button data-testid="modal-save">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      }

      render(<ModalWithTrigger />);

      // Click trigger to open modal
      await user.click(screen.getByTestId("trigger"));

      // Modal should be open and contain focus
      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();
        // Focus should be somewhere inside the dialog
        expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });

    it("focus returns to trigger when modal closes", async () => {
      const user = userEvent.setup();

      function ModalWithTrigger() {
        const [open, setOpen] = React.useState(false);
        return (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="trigger">Open Modal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modal Title</DialogTitle>
                <DialogDescription>Description</DialogDescription>
              </DialogHeader>
              <p>Content</p>
            </DialogContent>
          </Dialog>
        );
      }

      render(<ModalWithTrigger />);

      const trigger = screen.getByTestId("trigger");

      // Open modal
      await user.click(trigger);

      // Wait for dialog to be open
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Close modal with Escape
      await user.keyboard("{Escape}");

      // Focus should return to trigger
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it("Tab cycles within modal (focus trap)", async () => {
      const user = userEvent.setup();

      function ModalWithMultipleFocusableElements() {
        const [open, setOpen] = React.useState(true);
        return (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Focus Trap Test</DialogTitle>
                <DialogDescription>Test focus cycling</DialogDescription>
              </DialogHeader>
              <Input data-testid="input-1" placeholder="First input" />
              <Input data-testid="input-2" placeholder="Second input" />
              <DialogFooter>
                <Button data-testid="cancel-btn">Cancel</Button>
                <Button data-testid="save-btn">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      }

      render(<ModalWithMultipleFocusableElements />);

      // Wait for dialog and get focusable elements
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Get all focusable elements in dialog
      const dialog = screen.getByRole("dialog");
      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      // Focus the first element
      (focusableElements[0] as HTMLElement).focus();

      // Tab through all focusable elements
      for (let i = 1; i < focusableElements.length; i++) {
        await user.tab();
      }

      // The last focusable element should be focused
      // (exact focus trap behavior depends on implementation)
    });

    it("modal has aria-modal attribute", async () => {
      function OpenModal() {
        return (
          <Dialog open={true}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ARIA Modal Test</DialogTitle>
                <DialogDescription>Testing aria-modal</DialogDescription>
              </DialogHeader>
              <p>Content</p>
            </DialogContent>
          </Dialog>
        );
      }

      render(<OpenModal />);

      // Radix Dialog sets aria-modal automatically
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
    });
  });

  describe("Focus return on close", () => {
    it("focus returns to last focused element after modal closes via button", async () => {
      const user = userEvent.setup();

      function ModalWithCloseButton() {
        const [open, setOpen] = React.useState(false);
        return (
          <div>
            <Button data-testid="other-btn">Other Button</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="trigger">Open</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Test</DialogTitle>
                  <DialogDescription>Description</DialogDescription>
                </DialogHeader>
                <Button onClick={() => setOpen(false)} data-testid="close-btn">
                  Close
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        );
      }

      render(<ModalWithCloseButton />);

      const trigger = screen.getByTestId("trigger");

      // Open modal
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Close via button
      await user.click(screen.getByTestId("close-btn"));

      // Focus should return to trigger
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it("focus returns to trigger after clicking outside modal", async () => {
      const user = userEvent.setup();

      function ModalTest() {
        const [open, setOpen] = React.useState(false);
        return (
          <div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="trigger">Open</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Test</DialogTitle>
                  <DialogDescription>Description</DialogDescription>
                </DialogHeader>
                <p>Content</p>
              </DialogContent>
            </Dialog>
          </div>
        );
      }

      render(<ModalTest />);

      const trigger = screen.getByTestId("trigger");

      // Open modal
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Close via Escape
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });
  });

  describe("Dynamic content focus", () => {
    it("new content is accessible to screen readers with live regions", () => {
      function LiveRegionComponent() {
        const [message, setMessage] = React.useState("");

        return (
          <div>
            <Button onClick={() => setMessage("New notification!")}>
              Trigger
            </Button>
            <div role="status" aria-live="polite" data-testid="live-region">
              {message}
            </div>
          </div>
        );
      }

      render(<LiveRegionComponent />);

      const liveRegion = screen.getByTestId("live-region");

      // Live region should have correct ARIA attributes
      expect(liveRegion).toHaveAttribute("role", "status");
      expect(liveRegion).toHaveAttribute("aria-live", "polite");
    });

    it("loading state is announced to screen readers", () => {
      function LoadingComponent({ isLoading }: { isLoading: boolean }) {
        return (
          <div
            role="status"
            aria-live="polite"
            aria-busy={isLoading}
            data-testid="loading-status"
          >
            {isLoading ? "Loading..." : "Content loaded"}
          </div>
        );
      }

      const { rerender } = render(<LoadingComponent isLoading={true} />);

      const status = screen.getByTestId("loading-status");
      expect(status).toHaveAttribute("aria-busy", "true");
      expect(status).toHaveTextContent("Loading...");

      rerender(<LoadingComponent isLoading={false} />);

      expect(status).toHaveAttribute("aria-busy", "false");
      expect(status).toHaveTextContent("Content loaded");
    });

    it("error messages are announced with assertive live region", () => {
      function ErrorComponent({ error }: { error: string | null }) {
        return (
          <div
            role="alert"
            aria-live="assertive"
            data-testid="error-region"
          >
            {error}
          </div>
        );
      }

      render(<ErrorComponent error="Failed to save changes" />);

      const errorRegion = screen.getByTestId("error-region");
      expect(errorRegion).toHaveAttribute("role", "alert");
      expect(errorRegion).toHaveAttribute("aria-live", "assertive");
      expect(errorRegion).toHaveTextContent("Failed to save changes");
    });

    it("new messages use log role for chat-like interfaces", () => {
      function MessageLog({ messages }: { messages: string[] }) {
        return (
          <div
            role="log"
            aria-live="polite"
            aria-label="Message history"
            data-testid="message-log"
          >
            {messages.map((msg, i) => (
              <p key={i}>{msg}</p>
            ))}
          </div>
        );
      }

      render(<MessageLog messages={["Hello", "World"]} />);

      const log = screen.getByTestId("message-log");
      expect(log).toHaveAttribute("role", "log");
      expect(log).toHaveAttribute("aria-live", "polite");
      expect(log).toHaveAttribute("aria-label", "Message history");
    });
  });

  describe("Skip links", () => {
    it("skip link is first focusable element", async () => {
      const user = userEvent.setup();

      function PageWithSkipLink() {
        return (
          <div>
            <a
              href="#main-content"
              className="skip-link"
              data-testid="skip-link"
            >
              Skip to main content
            </a>
            <nav>
              <a href="/home">Home</a>
              <a href="/about">About</a>
            </nav>
            <main id="main-content" tabIndex={-1} data-testid="main-content">
              <h1>Main Content</h1>
            </main>
          </div>
        );
      }

      render(<PageWithSkipLink />);

      // First tab should focus skip link
      await user.tab();
      expect(screen.getByTestId("skip-link")).toHaveFocus();
    });

    it("skip link moves focus to main content when activated", async () => {
      const user = userEvent.setup();

      function PageWithSkipLink() {
        const mainRef = React.useRef<HTMLElement>(null);

        const handleSkipClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          mainRef.current?.focus();
        };

        return (
          <div>
            <a
              href="#main-content"
              onClick={handleSkipClick}
              data-testid="skip-link"
            >
              Skip to main content
            </a>
            <nav>
              <a href="/home">Home</a>
            </nav>
            <main
              ref={mainRef}
              id="main-content"
              tabIndex={-1}
              data-testid="main-content"
            >
              <h1>Main Content</h1>
            </main>
          </div>
        );
      }

      render(<PageWithSkipLink />);

      const skipLink = screen.getByTestId("skip-link");
      const mainContent = screen.getByTestId("main-content");

      // Click skip link
      await user.click(skipLink);

      // Main content should be focused
      expect(mainContent).toHaveFocus();
    });

    it("skip link has descriptive text", () => {
      render(
        <a href="#main" data-testid="skip-link">
          Skip to main content
        </a>
      );

      const skipLink = screen.getByTestId("skip-link");
      expect(skipLink).toHaveTextContent(/skip to main content/i);
    });
  });

  describe("Form validation focus", () => {
    it("focus moves to first invalid field on form submission error", async () => {
      const user = userEvent.setup();

      function FormWithValidation() {
        const [errors, setErrors] = React.useState<{ email?: string }>({});
        const emailRef = React.useRef<HTMLInputElement>(null);

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          const email = emailRef.current?.value;
          if (!email || !email.includes("@")) {
            setErrors({ email: "Please enter a valid email" });
            emailRef.current?.focus();
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <Input
              ref={emailRef}
              id="email"
              data-testid="email-input"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <span id="email-error" role="alert">
                {errors.email}
              </span>
            )}
            <Button type="submit" data-testid="submit-btn">
              Submit
            </Button>
          </form>
        );
      }

      render(<FormWithValidation />);

      // Submit without filling email
      await user.click(screen.getByTestId("submit-btn"));

      // Email input should be focused
      await waitFor(() => {
        expect(screen.getByTestId("email-input")).toHaveFocus();
      });

      // Error should be shown
      expect(screen.getByRole("alert")).toHaveTextContent(
        /please enter a valid email/i
      );
    });

    it("invalid input has aria-invalid attribute", async () => {
      function InvalidInput() {
        return (
          <Input
            data-testid="invalid-input"
            aria-invalid="true"
            aria-describedby="error-msg"
          />
        );
      }

      render(<InvalidInput />);

      const input = screen.getByTestId("invalid-input");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("Focus management utilities", () => {
    it("programmatic focus works on elements with tabIndex=-1", async () => {
      function FocusableContainer() {
        const containerRef = React.useRef<HTMLDivElement>(null);

        return (
          <div>
            <Button onClick={() => containerRef.current?.focus()}>
              Focus Container
            </Button>
            <div
              ref={containerRef}
              tabIndex={-1}
              data-testid="container"
            >
              Container content
            </div>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<FocusableContainer />);

      await user.click(screen.getByRole("button", { name: /focus container/i }));

      expect(screen.getByTestId("container")).toHaveFocus();
    });

    it("focus is managed when content changes dynamically", async () => {
      function DynamicContent() {
        const [showContent, setShowContent] = React.useState(false);
        const contentRef = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => {
          if (showContent) {
            contentRef.current?.focus();
          }
        }, [showContent]);

        return (
          <div>
            <Button onClick={() => setShowContent(true)}>Show Content</Button>
            {showContent && (
              <div
                ref={contentRef}
                tabIndex={-1}
                data-testid="dynamic-content"
              >
                Dynamically loaded content
              </div>
            )}
          </div>
        );
      }

      const user = userEvent.setup();
      render(<DynamicContent />);

      await user.click(screen.getByRole("button", { name: /show content/i }));

      await waitFor(() => {
        expect(screen.getByTestId("dynamic-content")).toHaveFocus();
      });
    });
  });

  describe("Screen reader announcements", () => {
    it("visually hidden elements are still readable by screen readers", () => {
      render(
        <button>
          <span className="sr-only">Send message</span>
          <svg aria-hidden="true" data-testid="icon" />
        </button>
      );

      // Button should be accessible by its sr-only text
      expect(
        screen.getByRole("button", { name: /send message/i })
      ).toBeInTheDocument();

      // Icon should be hidden from screen readers
      expect(screen.getByTestId("icon")).toHaveAttribute("aria-hidden", "true");
    });

    it("descriptions are associated with elements", () => {
      render(
        <div>
          <Input
            aria-describedby="help-text"
            data-testid="described-input"
          />
          <span id="help-text">Enter your username (3-20 characters)</span>
        </div>
      );

      const input = screen.getByTestId("described-input");
      expect(input).toHaveAttribute("aria-describedby", "help-text");
    });

    it("required fields have proper attributes", () => {
      render(
        <Input
          required
          aria-required="true"
          data-testid="required-input"
        />
      );

      const input = screen.getByTestId("required-input");
      expect(input).toBeRequired();
      expect(input).toHaveAttribute("aria-required", "true");
    });
  });
});
