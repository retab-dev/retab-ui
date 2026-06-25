// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VirtualList } from "@/components/json-form/virtual-list";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("JsonForm VirtualList", () => {
  it("renders a bounded initial window with the correct spacer height", () => {
    const fields = createFields(200);

    render(
      <VirtualList
        fields={fields}
        estimateSize={20}
        renderItem={(index) => (
          <div data-testid={`field-${fields[index]!.id}`}>
            {fields[index]!.id}
          </div>
        )}
      />,
    );

    expect(screen.getByTestId("field-field-0")).toBeTruthy();
    expect(screen.getByTestId("field-field-37")).toBeTruthy();
    expect(screen.queryByTestId("field-field-80")).toBeNull();
    const spacer = screen.getByTestId("field-field-0").closest(
      '[data-slot="json-form-virtual-list-spacer"]',
    ) as HTMLDivElement;
    const rowWindow = screen.getByTestId("field-field-0").closest(
      '[data-slot="json-form-virtual-list-row-window"]',
    ) as HTMLDivElement;
    expect(spacer.style.height).toBe("4000px");
    expect(spacer.style.position).toBe("relative");
    expect(rowWindow.style.position).toBe("sticky");
    expect(rowWindow.style.marginTop).toBe("0px");
    expect(rowWindow.style.height).not.toBe("4000px");
  });

  it("updates the rendered window when the list scrolls", async () => {
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const fields = createFields(200);
    const { container } = render(
      <VirtualList
        fields={fields}
        estimateSize={20}
        maxHeight={60}
        renderItem={(index) => (
          <div data-testid={`field-${fields[index]!.id}`}>
            {fields[index]!.id}
          </div>
        )}
      />,
    );
    const scroller = container.firstElementChild as HTMLDivElement;
    defineElementMetric(scroller, "clientHeight", 60);
    defineElementMetric(scroller, "scrollTop", 0);

    act(() => {
      scroller.scrollTop = 1_000;
      fireEvent.scroll(scroller);
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-field-50")).toBeTruthy();
    });
    expect(screen.queryByTestId("field-field-0")).toBeNull();
    const rowWindow = screen.getByTestId("field-field-50").closest(
      '[data-slot="json-form-virtual-list-row-window"]',
    ) as HTMLDivElement;
    expect(rowWindow.style.position).toBe("sticky");
    expect(rowWindow.style.marginTop).toBe("840px");
    expect(screen.getByTestId("field-field-50").parentElement?.style.transform)
      .toBe("translateY(160px)");
  });

  it("keeps row state keyed by field id across reorders", () => {
    let nextToken = 0;

    function StatefulField({ field }: { field: { id: string } }) {
      const tokenRef = React.useRef(++nextToken);

      return (
        <div data-testid={`field-${field.id}`}>
          {field.id}:{tokenRef.current}
        </div>
      );
    }

    function Harness({ fields }: { fields: { id: string }[] }) {
      return (
        <VirtualList
          fields={fields}
          estimateSize={20}
          renderItem={(index) => <StatefulField field={fields[index]!} />}
        />
      );
    }

    const firstFields = createFields(3);
    const { rerender } = render(<Harness fields={firstFields} />);
    const field0Token = screen.getByTestId("field-field-0").textContent;
    const field1Token = screen.getByTestId("field-field-1").textContent;

    rerender(
      <Harness fields={[firstFields[1]!, firstFields[0]!, firstFields[2]!]} />,
    );

    expect(screen.getByTestId("field-field-0").textContent).toBe(field0Token);
    expect(screen.getByTestId("field-field-1").textContent).toBe(field1Token);
  });
});

function createFields(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `field-${index}`,
  }));
}

function defineElementMetric(
  element: HTMLElement,
  key: "clientHeight" | "scrollTop",
  value: number,
) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
    writable: true,
  });
}

class StubResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}
