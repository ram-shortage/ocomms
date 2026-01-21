/**
 * MessageInput component tests
 *
 * Tests core message input functionality:
 * - Text input behavior
 * - Send functionality with Enter key
 * - Shift+Enter for newlines
 * - Character limit validation
 * - Clear after send
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock for sendMessage that we can track
const mockSendMessage = vi.fn().mockResolvedValue(undefined);

// Mock the dependencies
vi.mock("@/lib/socket-client", () => ({
  useSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-send-message", () => ({
  useSendMessage: () => ({
    sendMessage: mockSendMessage,
    isOnline: true,
  }),
}));

// Import after mocks
import { MessageInput } from "../message/message-input";

describe("MessageInput", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  describe("Input behavior", () => {
    it("types text into input", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Hello world");

      expect(input).toHaveValue("Hello world");
    });

    it("shows character count", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Hello");

      // Character count format: 5/10,000
      expect(screen.getByText(/5\/10,000/)).toBeInTheDocument();
    });

    it("disables send button for empty input", () => {
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const sendButton = screen.getByRole("button", { name: /send now/i });
      expect(sendButton).toBeDisabled();
    });

    it("enables send button when input has content", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Hello");

      const sendButton = screen.getByRole("button", { name: /send now/i });
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe("Send functionality", () => {
    it("calls sendMessage with content when send button clicked", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Hello world");

      const sendButton = screen.getByRole("button", { name: /send now/i });
      await user.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith("Hello world", undefined);
    });

    it("sends on Enter key", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Hello");
      await user.keyboard("{Enter}");

      expect(mockSendMessage).toHaveBeenCalledWith("Hello", undefined);
    });

    it("clears input after send", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Hello world");
      await user.keyboard("{Enter}");

      // Wait for the state update
      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });

    it("trims whitespace before sending", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "  Hello world  ");
      await user.keyboard("{Enter}");

      expect(mockSendMessage).toHaveBeenCalledWith("Hello world", undefined);
    });

    it("does not send empty or whitespace-only messages", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "   ");
      await user.keyboard("{Enter}");

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("Shift+Enter behavior", () => {
    it("adds newline on Shift+Enter", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Line 1");
      await user.keyboard("{Shift>}{Enter}{/Shift}");
      await user.type(input, "Line 2");

      expect(input).toHaveValue("Line 1\nLine 2");
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("Character limit validation", () => {
    it("shows character count in red when over limit", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      // Type more than 10,000 characters
      const longText = "a".repeat(10001);
      // Use fireEvent for performance with long text
      fireEvent.change(input, { target: { value: longText } });

      // Should show error styling
      const counter = screen.getByText(/10,001\/10,000/);
      expect(counter).toHaveClass("text-red-500");
    });

    it("shows 'Message too long' warning when over limit", async () => {
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      const longText = "a".repeat(10001);
      fireEvent.change(input, { target: { value: longText } });

      expect(screen.getByText("Message too long")).toBeInTheDocument();
    });

    it("disables send button when over character limit", async () => {
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      const longText = "a".repeat(10001);
      fireEvent.change(input, { target: { value: longText } });

      const sendButton = screen.getByRole("button", { name: /send now/i });
      expect(sendButton).toBeDisabled();
    });
  });

  describe("DM vs Channel placeholders", () => {
    it("shows channel placeholder for channel type", () => {
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("placeholder", "Type a message...");
    });

    it("shows dm placeholder for dm type", () => {
      render(<MessageInput targetId="dm-1" targetType="dm" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("placeholder", "Type a message...");
    });
  });

  describe("Accessibility", () => {
    it("has accessible send button", () => {
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const sendButton = screen.getByRole("button", { name: /send now/i });
      expect(sendButton).toBeInTheDocument();
    });

    it("textarea is focusable", async () => {
      const user = userEvent.setup();
      render(<MessageInput targetId="channel-1" targetType="channel" />);

      const input = screen.getByRole("textbox");
      await user.click(input);

      expect(input).toHaveFocus();
    });
  });
});
