/**
 * MentionAutocomplete component tests
 *
 * Tests mention autocomplete functionality:
 * - Display of member suggestions
 * - Filtering as user types
 * - Keyboard navigation (Arrow keys)
 * - Selection via Enter/Tab/Click
 * - Escape to close
 * - Special mentions (@channel, @here)
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import the component
import { MentionAutocomplete, type MentionMember } from "../message/mention-autocomplete";

const mockMembers: MentionMember[] = [
  { id: "user-1", name: "Alice Anderson", email: "alice@example.com" },
  { id: "user-2", name: "Bob Brown", email: "bob@example.com" },
  { id: "user-3", name: "Charlie Chen", email: "charlie@example.com" },
  { id: "user-4", name: null, email: "david@example.com" }, // User without name
  { id: "user-5", name: "Eve Evans", email: "eve@example.com" },
];

const defaultProps = {
  members: mockMembers,
  filter: "",
  onSelect: vi.fn(),
  onClose: vi.fn(),
  position: { top: 8, left: 0 },
};

describe("MentionAutocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Display", () => {
    it("renders special mentions when filter is empty", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      expect(screen.getByText("@channel")).toBeInTheDocument();
      expect(screen.getByText("@here")).toBeInTheDocument();
      expect(screen.getByText("Notify all members")).toBeInTheDocument();
      expect(screen.getByText("Notify active members")).toBeInTheDocument();
    });

    it("renders member names", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      expect(screen.getByText("Alice Anderson")).toBeInTheDocument();
      expect(screen.getByText("Bob Brown")).toBeInTheDocument();
      expect(screen.getByText("Charlie Chen")).toBeInTheDocument();
    });

    it("renders member emails", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });

    it("shows email username for members without name", () => {
      // Filter to only show the user without a name
      render(<MentionAutocomplete {...defaultProps} filter="david" />);

      // User without name should show email username as display name
      expect(screen.getByText("david")).toBeInTheDocument();
      expect(screen.getByText("david@example.com")).toBeInTheDocument();
    });

    it("limits results to 5 items", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      // 2 special mentions + 3 members = 5 max items shown
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeLessThanOrEqual(5);
    });

    it("returns null when no results match filter", () => {
      const { container } = render(
        <MentionAutocomplete {...defaultProps} filter="xyz" />
      );

      // Component should render nothing
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Filtering", () => {
    it("filters members by name prefix", () => {
      render(<MentionAutocomplete {...defaultProps} filter="ali" />);

      expect(screen.getByText("Alice Anderson")).toBeInTheDocument();
      expect(screen.queryByText("Bob Brown")).not.toBeInTheDocument();
    });

    it("filters members by email prefix", () => {
      render(<MentionAutocomplete {...defaultProps} filter="bob" />);

      expect(screen.getByText("Bob Brown")).toBeInTheDocument();
      expect(screen.queryByText("Alice Anderson")).not.toBeInTheDocument();
    });

    it("filters special mentions", () => {
      render(<MentionAutocomplete {...defaultProps} filter="chan" />);

      expect(screen.getByText("@channel")).toBeInTheDocument();
      expect(screen.queryByText("@here")).not.toBeInTheDocument();
    });

    it("filtering is case insensitive", () => {
      render(<MentionAutocomplete {...defaultProps} filter="ALICE" />);

      expect(screen.getByText("Alice Anderson")).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    it("navigates down with ArrowDown key", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      // First item should be selected initially (index 0)
      // Press ArrowDown to select next item
      fireEvent.keyDown(document, { key: "ArrowDown" });

      // The second item should now have aria-selected or be highlighted
      // Since the component uses selectedIndex state, we verify by checking
      // which item has the highlight class after navigation
      const items = screen.getAllByRole("button");
      // After ArrowDown, second item should be highlighted
      expect(items[1]).toHaveClass("bg-muted");
    });

    it("navigates up with ArrowUp key", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      // Start at 0, go down once, then up
      fireEvent.keyDown(document, { key: "ArrowDown" });
      fireEvent.keyDown(document, { key: "ArrowUp" });

      const items = screen.getAllByRole("button");
      // Should be back at first item
      expect(items[0]).toHaveClass("bg-muted");
    });

    it("wraps around at end of list", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      const items = screen.getAllByRole("button");
      const itemCount = items.length;

      // Navigate down past the last item - should wrap to first
      for (let i = 0; i < itemCount; i++) {
        fireEvent.keyDown(document, { key: "ArrowDown" });
      }

      // First item should be highlighted again
      expect(items[0]).toHaveClass("bg-muted");
    });

    it("wraps around at start of list", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      // At index 0, pressing ArrowUp should go to last item
      fireEvent.keyDown(document, { key: "ArrowUp" });

      const items = screen.getAllByRole("button");
      // Last item should be highlighted
      expect(items[items.length - 1]).toHaveClass("bg-muted");
    });
  });

  describe("Selection", () => {
    it("calls onSelect with member name on Enter", () => {
      const onSelect = vi.fn();
      render(
        <MentionAutocomplete {...defaultProps} filter="ali" onSelect={onSelect} />
      );

      fireEvent.keyDown(document, { key: "Enter" });

      expect(onSelect).toHaveBeenCalledWith("Alice Anderson");
    });

    it("calls onSelect with member name on Tab", () => {
      const onSelect = vi.fn();
      render(
        <MentionAutocomplete {...defaultProps} filter="ali" onSelect={onSelect} />
      );

      fireEvent.keyDown(document, { key: "Tab" });

      expect(onSelect).toHaveBeenCalledWith("Alice Anderson");
    });

    it("calls onSelect on click", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <MentionAutocomplete {...defaultProps} filter="" onSelect={onSelect} />
      );

      await user.click(screen.getByText("Bob Brown"));

      expect(onSelect).toHaveBeenCalledWith("Bob Brown");
    });

    it("calls onSelect with special mention type", () => {
      const onSelect = vi.fn();
      render(
        <MentionAutocomplete {...defaultProps} filter="chan" onSelect={onSelect} />
      );

      fireEvent.keyDown(document, { key: "Enter" });

      expect(onSelect).toHaveBeenCalledWith("channel");
    });

    it("uses email username for members without name", () => {
      const onSelect = vi.fn();
      // Filter to only show david (no name)
      render(
        <MentionAutocomplete {...defaultProps} filter="david" onSelect={onSelect} />
      );

      fireEvent.keyDown(document, { key: "Enter" });

      expect(onSelect).toHaveBeenCalledWith("david");
    });
  });

  describe("Closing", () => {
    it("calls onClose on Escape key", () => {
      const onClose = vi.fn();
      render(<MentionAutocomplete {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });

    it("calls onClose on click outside", async () => {
      const onClose = vi.fn();
      render(
        <div data-testid="outside">
          <MentionAutocomplete {...defaultProps} onClose={onClose} />
        </div>
      );

      // Click outside the autocomplete
      fireEvent.mouseDown(document.body);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Mouse Hover", () => {
    it("highlights item on mouse enter", async () => {
      const user = userEvent.setup();
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      const items = screen.getAllByRole("button");
      await user.hover(items[2]);

      expect(items[2]).toHaveClass("bg-muted");
    });
  });

  describe("Accessibility", () => {
    it("renders with button roles", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("shows member avatar initials", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      // Alice's initial should appear
      expect(screen.getByText("A")).toBeInTheDocument();
      // Bob's initial should appear
      expect(screen.getByText("B")).toBeInTheDocument();
    });

    it("shows @ icon for special mentions", () => {
      render(<MentionAutocomplete {...defaultProps} filter="" />);

      // @ symbols for special mentions
      const atSymbols = screen.getAllByText("@");
      expect(atSymbols.length).toBeGreaterThan(0);
    });
  });
});
