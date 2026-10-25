// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "@/components/ui/toast";

function Probe() {
  const toast = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const id = toast.push({ kind: "pending", title: "Creating bounty…" });
          // what every tx flow does once the runner answers
          toast.update(id, { kind: "error", title: "Create failed", description: "boom" });
        }}
      >
        run-tx
      </button>
    </div>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("toast auto-dismiss", () => {
  it("dismisses a pending toast once it is updated to a final kind", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("run-tx").click();
    });
    expect(screen.getByText("Create failed")).toBeTruthy();

    // pending toasts never schedule their own dismissal — update() must
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText("Create failed")).toBeNull();
  });

  it("keeps a pending toast on screen until it resolves", () => {
    vi.useFakeTimers();
    function Pending() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.push({ kind: "pending", title: "Waiting…" })}>
          push-pending
        </button>
      );
    }
    render(
      <ToastProvider>
        <Pending />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("push-pending").click();
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("Waiting…")).toBeTruthy();
  });
});
