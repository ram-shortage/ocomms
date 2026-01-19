import "@testing-library/jest-dom/vitest";
import { vi, beforeAll, afterEach } from "vitest";
import React from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/test",
  useParams: () => ({}),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: function MockImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return React.createElement("img", props);
  },
}));

// Create mock socket that can be imported in tests
export const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

// Mock socket.io-client
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock the socket client hook
vi.mock("@/lib/socket-client", () => ({
  useSocket: () => mockSocket,
  SocketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the cache module
vi.mock("@/lib/cache", () => ({
  cacheMessage: vi.fn(),
  cacheMessages: vi.fn(),
  updateMessageDeletion: vi.fn(),
  useCachedChannelMessages: () => [],
  useCachedConversationMessages: () => [],
  useSendQueue: () => [],
  processQueue: vi.fn(),
}));

// Mock the online status hook
vi.mock("@/lib/pwa/use-online-status", () => ({
  useOnlineStatus: () => ({ isOnline: true }),
}));

// Mock useSendMessage hook
vi.mock("@/hooks/use-send-message", () => ({
  useSendMessage: () => ({
    sendMessage: vi.fn().mockResolvedValue(undefined),
    isOnline: true,
  }),
}));

// Global setup - only for jsdom environment
beforeAll(() => {
  // Only run browser mocks in jsdom environment
  if (typeof window !== "undefined") {
    // Mock matchMedia for responsive components
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  // Mock ResizeObserver
  if (typeof global.ResizeObserver === "undefined") {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }

  // Mock IntersectionObserver
  if (typeof global.IntersectionObserver === "undefined") {
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
