import React from "react";
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { buildLucideModule } from "@/test/build-lucide-module";
import { createRenderRoot } from "@/test/render-root";

function Passthrough({ children }: { children?: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

function DivElement({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("div", props, children);
}

function TableElement({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("table", props, children);
}

function TableSectionElement({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("tbody", props, children);
}

function TableHeaderElement({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("thead", props, children);
}

function TableRowElement({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("tr", props, children);
}

function TableCellElement({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("td", props, children);
}

function TableHeadCellElement({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("th", props, children);
}

function ButtonElement({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement("button", props, children);
}

function InputElement(props: Record<string, unknown>) {
  return React.createElement("input", props);
}

function DropdownMenuRadioGroupElement({
  children,
  onValueChange: _onValueChange,
  value: _value,
  ...props
}: {
  children?: React.ReactNode;
  onValueChange?: (value: string) => void;
  value?: string;
  [key: string]: unknown;
}) {
  return React.createElement("div", props, children);
}

function DropdownMenuRadioItemElement({
  children,
  value: _value,
  ...props
}: {
  children?: React.ReactNode;
  value?: string;
  [key: string]: unknown;
}) {
  return React.createElement("div", props, children);
}

mock.module("@/components/ui/dialog", () => ({
  Dialog: Passthrough,
  DialogClose: ButtonElement,
  DialogContent: DivElement,
  DialogHeader: DivElement,
  DialogFooter: DivElement,
  DialogOverlay: DivElement,
  DialogPortal: Passthrough,
  DialogTrigger: Passthrough,
  DialogTitle: DivElement,
  DialogDescription: DivElement,
}));

mock.module("@/components/ui/table", () => ({
  Table: TableElement,
  TableHeader: TableHeaderElement,
  TableBody: TableSectionElement,
  TableRow: TableRowElement,
  TableHead: TableHeadCellElement,
  TableCell: TableCellElement,
}));

mock.module("@/components/ui/button", () => ({
  Button: ButtonElement,
  buttonVariants: () => "",
}));

mock.module("@/components/ui/input", () => ({
  Input: InputElement,
  InputArea: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("textarea", props, children),
}));

mock.module("@/components/ui/skeleton", () => ({
  Skeleton: DivElement,
}));

mock.module("@/components/ui/tooltip", () => ({
  Tooltip: Passthrough,
  TooltipContent: DivElement,
  TooltipProvider: Passthrough,
  TooltipTrigger: Passthrough,
}));

mock.module("@/components/ui/popover", () => ({
  Popover: Passthrough,
  PopoverContent: DivElement,
  PopoverTrigger: Passthrough,
}));

mock.module("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: Passthrough,
  DropdownMenuCheckboxItem: DropdownMenuRadioItemElement,
  DropdownMenuContent: DivElement,
  DropdownMenuGroup: DivElement,
  DropdownMenuItem: DivElement,
  DropdownMenuLabel: DivElement,
  DropdownMenuPortal: Passthrough,
  DropdownMenuRadioGroup: DropdownMenuRadioGroupElement,
  DropdownMenuRadioItem: DropdownMenuRadioItemElement,
  DropdownMenuSeparator: DivElement,
  DropdownMenuShortcut: DivElement,
  DropdownMenuSub: Passthrough,
  DropdownMenuSubContent: DivElement,
  DropdownMenuSubTrigger: DivElement,
  DropdownMenuTrigger: Passthrough,
}));

mock.module("@/components/ui/alert-dialog", () => ({
  AlertDialog: Passthrough,
  AlertDialogAction: ButtonElement,
  AlertDialogCancel: ButtonElement,
  AlertDialogContent: DivElement,
  AlertDialogDescription: DivElement,
  AlertDialogFooter: DivElement,
  AlertDialogHeader: DivElement,
  AlertDialogTitle: DivElement,
}));

mock.module("lucide-react", () => buildLucideModule());

const refetchMock = mock(async () => undefined);
const usePartitionListMock = mock(() => ({
  data: {
    data: [
      {
        id: "partition_1",
        organization_id: "org_1",
        file: {
          id: "file_1",
          filename: "statement.pdf",
          mime_type: "application/pdf",
        },
        model: "retab-small",
        key: "account_number",
        instructions: "",
        n_consensus: 1,
        output: [{ key: "account_number", pages: [1] }],
        consensus: { choices: [], likelihoods: null },
        created_at: "2026-04-20T10:00:00Z",
        updated_at: "2026-04-20T10:00:00Z",
      },
    ],
    list_metadata: {
      before: null,
      after: null,
    },
  },
  isLoading: false,
  fetchStatus: "idle" as const,
  refetch: refetchMock,
}));
const deletePartitionMock = mock(async () => undefined);

mock.module("@/app/dashboard/widgets/queries/partitions", () => ({
  usePartitionList: (...args: Parameters<typeof usePartitionListMock>) =>
    usePartitionListMock(...args),
  useDeletePartition: () => ({
    mutateAsync: deletePartitionMock,
  }),
}));

// UI-signaling capability gate. Drive it via a mock so render tests don't need
// the auth/query providers. Defaults to granted (delete affordance visible).
const canOrganizationMock = mock(() => true);
import * as authorizationChecksModule from "@/app/dashboard/shared/authz/authorization-checks";
mock.module("@/app/dashboard/shared/authz/authorization-checks", () => ({
  ...authorizationChecksModule,
  useCanOrganization: (...args: Parameters<typeof canOrganizationMock>) =>
    canOrganizationMock(...args),
}));

const historyDialogModule = await import(
  new URL(
    `./history-dialog.tsx?test=${Date.now()}-${Math.random()}`,
    import.meta.url,
  ).href
);
const { PartitionHistoryDialog } = historyDialogModule;

describe("partition history dialog", () => {
  beforeEach(() => {
    refetchMock.mockReset();
    deletePartitionMock.mockReset();
    usePartitionListMock.mockReset();
    usePartitionListMock.mockImplementation(() => ({
      data: {
        data: [
          {
            id: "partition_1",
            organization_id: "org_1",
            file: {
              id: "file_1",
              filename: "statement.pdf",
              mime_type: "application/pdf",
            },
            model: "retab-small",
            key: "account_number",
            instructions: "",
            n_consensus: 1,
            output: [{ key: "account_number", pages: [1] }],
            consensus: { choices: [], likelihoods: null },
            created_at: "2026-04-20T10:00:00Z",
            updated_at: "2026-04-20T10:00:00Z",
          },
        ],
        list_metadata: {
          before: null,
          after: null,
        },
      },
      isLoading: false,
      fetchStatus: "idle" as const,
      refetch: refetchMock,
    }));
  });

  // The row action menu's "Delete partition" button is hidden when the
  // capability is absent. The AlertDialog title ("Delete partition") is always
  // mounted by the Passthrough mock, so count occurrences: capability present
  // yields the menu button + the confirm title (2); absent yields only the
  // confirm title (1).
  const countDeleteLabels = (text: string | null) =>
    (text ?? "").split("Delete partition").length - 1;

  test("hides the row delete affordance when rbac:partition:delete is missing", async () => {
    const mounted = createRenderRoot();
    try {
      canOrganizationMock.mockImplementation(() => false);
      await mounted.render(
        <PartitionHistoryDialog open={true} onOpenChange={() => {}} />,
      );
      expect(countDeleteLabels(mounted.container.textContent)).toBe(1);
    } finally {
      canOrganizationMock.mockImplementation(() => true);
      mounted.unmount();
    }
  });

  test("shows the row delete affordance when rbac:partition:delete is present", async () => {
    const mounted = createRenderRoot();
    try {
      canOrganizationMock.mockImplementation(() => true);
      await mounted.render(
        <PartitionHistoryDialog open={true} onOpenChange={() => {}} />,
      );
      expect(countDeleteLabels(mounted.container.textContent)).toBe(2);
    } finally {
      mounted.unmount();
    }
  });

  test("refetches cached history each time the dialog opens", async () => {
    const mounted = createRenderRoot();

    try {
      await mounted.render(
        <PartitionHistoryDialog open={false} onOpenChange={() => {}} />,
      );

      expect(refetchMock).not.toHaveBeenCalled();

      await mounted.render(
        <PartitionHistoryDialog open={true} onOpenChange={() => {}} />,
      );

      expect(refetchMock).toHaveBeenCalledTimes(1);

      await mounted.render(
        <PartitionHistoryDialog open={false} onOpenChange={() => {}} />,
      );
      await mounted.render(
        <PartitionHistoryDialog open={true} onOpenChange={() => {}} />,
      );

      expect(refetchMock).toHaveBeenCalledTimes(2);
    } finally {
      mounted.unmount();
    }
  });
});

afterAll(() => {
  mock.restore();
});
