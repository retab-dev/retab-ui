"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/app/dashboard/shared/hooks/use-debounce";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ArrowUpWideNarrowIcon,
  ArrowDownWideNarrowIcon,
  MoreVertical,
  Trash2,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { apiClient, unwrapApi } from "@/app/shared/api/client";
import type { ProcessingLog } from "@/types";
import { useDeleteEdit } from "@/app/dashboard/widgets/queries/edits";
import { EditType } from "@/app/dashboard/widgets/types/edit";
import type { Edit } from "@/types";
import { useCanOrganization } from "@/app/dashboard/shared/authz/authorization-checks";

interface ProcessingLogsResponse {
  data: ProcessingLog[];
  list_metadata?: {
    before: string | null;
    after: string | null;
  };
}

interface HistoryRow {
  row_key: string;
  processing_log_id: string;
  filename: string;
  created_at: string;
  model_name: string | null;
  edit_id: string | null;
  edit_type: EditType;
}

interface DeleteTarget {
  row_key: string;
  edit_id: string;
  edit_type: EditType;
}

export const EditHistoryDialog = ({
  open,
  onOpenChange,
  onSelectEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectEdit?: (edit: Edit) => void;
}) => {
  // Pagination state
  const [editsBefore, setEditsBefore] = useState<string | null>(null);
  const [editsAfter, setEditsAfter] = useState<string | null>(null);

  // Display settings
  const [isDisplayPopoverOpen, setIsDisplayPopoverOpen] = useState(false);
  const [limit, setLimitState] = useState(10);
  const [sortField, setSortFieldState] = useState<string>("created_at");
  const [sortDirection, setSortDirectionState] = useState<"asc" | "desc">(
    "desc",
  );

  const resetPagination = () => {
    setEditsBefore(null);
    setEditsAfter(null);
  };

  const setLimit = (value: number) => {
    resetPagination();
    setLimitState(value);
  };
  const setSortField = (value: string) => {
    resetPagination();
    setSortFieldState(value);
  };
  const setSortDirection = (value: "asc" | "desc") => {
    resetPagination();
    setSortDirectionState(value);
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    resetPagination();
  };

  // Load/Delete state. UI signaling: hide the delete affordance when the edit
  // primitive capability is absent (no distinct edit-delete policy exists, so
  // the page primitive governs history delete).
  const canDeleteEdit = useCanOrganization("rbac:primitive:edit");
  const { mutateAsync: deleteAgentEdit } = useDeleteEdit("agent");
  const { mutateAsync: deleteTemplateEdit } = useDeleteEdit("template");
  const [loadingRowKey, setLoadingRowKey] = useState<string | null>(null);
  const [deletingRowKey, setDeletingRowKey] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] =
    useState<DeleteTarget | null>(null);

  const historyQuery = useQuery<ProcessingLogsResponse, Error>({
    queryKey: [
      "edit-history-logs",
      {
        limit,
        sortField,
        sortDirection,
        debouncedSearchQuery,
        editsBefore,
        editsAfter,
      },
    ],
    queryFn: async () => {
      const data = await unwrapApi(
        apiClient.GET("/v1/processing-logs", {
          params: {
            query: {
              limit,
              operation: "edit",
              order: sortField === "created_at" ? sortDirection : "desc",
              filename_contains: debouncedSearchQuery || undefined,
              before: editsBefore ?? undefined,
              after: !editsBefore && editsAfter ? editsAfter : undefined,
            },
          },
        }),
        "Failed to fetch edit history",
      );
      // The contract types `data` as the generated `ProcessingLog`; this dialog
      // reads the Zod `ProcessingLog` (id required, same wire JSON). Cast at the
      // boundary, as elsewhere in the playground.
      return data as unknown as ProcessingLogsResponse;
    },
    enabled: open,
    refetchOnMount: "always",
  });

  const historyError = historyQuery.isError ? historyQuery.failureCount : 0;
  const pageIds = {
    before: historyQuery.data?.list_metadata?.before ?? null,
    after: historyQuery.data?.list_metadata?.after ?? null,
  };
  const isLoading = historyQuery.isFetching;

  const historyRows = useMemo<HistoryRow[]>(() => {
    const historyLogs = historyQuery.data?.data ?? [];
    const rows = historyLogs
      .filter((log) => log.operation === "edit")
      .map((log) => {
        const editType: EditType =
          log.edit_props?.edit_type === "template" ? "template" : "agent";
        const editId = log.edit_props?.edit_id ?? null;
        return {
          row_key: `${log.id}:${editType}:${editId || "missing"}`,
          processing_log_id: log.id ?? "",
          filename: log.filename || "Unknown",
          created_at: log.created_at ?? "",
          model_name: log.edit_props?.model_name ?? null,
          edit_id: editId,
          edit_type: editType,
        };
      });

    if (sortField !== "filename") {
      return rows;
    }

    return rows.sort((a, b) => {
      const compared = a.filename.localeCompare(b.filename, undefined, {
        sensitivity: "base",
      });
      return sortDirection === "asc" ? compared : -compared;
    });
  }, [historyQuery.data?.data, sortField, sortDirection]);

  const sortFields = useMemo(
    () => [
      { value: "created_at", label: "Date Created" },
      { value: "filename", label: "Filename" },
    ],
    [],
  );

  const editsNextPage = useCallback(() => {
    if (pageIds.before) {
      setEditsBefore(pageIds.before);
      setEditsAfter(null);
    }
  }, [pageIds.before]);

  const editsPrevPage = useCallback(() => {
    if (pageIds.after) {
      setEditsAfter(pageIds.after);
      setEditsBefore(null);
    }
  }, [pageIds.after]);

  const handleEditClick = useCallback(
    async (row: HistoryRow) => {
      if (!row.edit_id) {
        toast.error(
          "This log entry does not contain an editable history record",
        );
        return;
      }

      setLoadingRowKey(row.row_key);
      try {
        const { data, response } = await apiClient.GET("/v1/edits/{edit_id}", {
          params: { path: { edit_id: row.edit_id } },
        });

        if (response.status === 404) {
          toast.error("This edit record is no longer available");
          return;
        }
        if (!response.ok || !data) {
          throw new Error("Failed to load edit");
        }

        onSelectEdit?.(data);
        onOpenChange(false);
      } catch {
        toast.error("Failed to load edit from history");
      } finally {
        setLoadingRowKey(null);
      }
    },
    [onSelectEdit, onOpenChange],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, row: HistoryRow) => {
      e.stopPropagation();
      if (!canDeleteEdit) return;
      if (!row.edit_id) {
        toast.error("Cannot delete: missing edit id");
        return;
      }
      setDeleteConfirmTarget({
        row_key: row.row_key,
        edit_id: row.edit_id,
        edit_type: row.edit_type,
      });
      setOpenMenuId(null);
    },
    [canDeleteEdit],
  );

  const handleDeleteConfirm = useCallback(async () => {
    // Fail-closed guard: never call the delete mutation without the capability.
    if (!canDeleteEdit) return;
    if (!deleteConfirmTarget) return;

    setDeletingRowKey(deleteConfirmTarget.row_key);
    try {
      if (deleteConfirmTarget.edit_type === "template") {
        await deleteTemplateEdit(deleteConfirmTarget.edit_id);
      } else {
        await deleteAgentEdit(deleteConfirmTarget.edit_id);
      }
      setDeleteConfirmTarget(null);
      await historyQuery.refetch();
    } finally {
      setDeletingRowKey(null);
    }
  }, [
    canDeleteEdit,
    deleteConfirmTarget,
    deleteTemplateEdit,
    deleteAgentEdit,
    historyQuery,
  ]);

  const getFileIcon = () => {
    return <FileText className="text-muted-foreground h-4 w-4" />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] min-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>History</DialogTitle>
            <DialogDescription className="sr-only">
              View and load your previous edit results
            </DialogDescription>
          </DialogHeader>

          {/* Search and Display Controls */}
          <div className="flex items-center justify-between gap-2 px-6 pb-4">
            <div className="relative w-64">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-3.5 w-3.5" />
              <Input
                placeholder="Search by filename..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>

            <Popover
              open={isDisplayPopoverOpen}
              onOpenChange={setIsDisplayPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                  <span>Display</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-gray-900">
                      Items per page
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[5, 10, 25, 50, 100].map((value) => (
                        <button
                          key={value}
                          onClick={() => setLimit(value)}
                          className={`rounded border px-3 py-2 text-xs transition-all ${
                            limit === value
                              ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700"
                              : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-200" />

                  <div className="flex flex-col gap-2">
                    <label className="block text-xs font-semibold text-gray-900">
                      Sort by
                    </label>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-9 min-w-0 flex-1 justify-between text-xs"
                          >
                            <span className="truncate">
                              {sortFields.find((f) => f.value === sortField)
                                ?.label || "Select field"}
                            </span>
                            <ChevronRight className="ml-2 h-3.5 w-3.5 shrink-0 rotate-90 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuRadioGroup
                            value={sortField}
                            onValueChange={setSortField}
                          >
                            {sortFields.map((field) => (
                              <DropdownMenuRadioItem
                                key={field.value}
                                value={field.value}
                                className="text-xs"
                              >
                                {field.label}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => setSortDirection("asc")}
                          className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
                            sortDirection === "asc"
                              ? "bg-indigo-50 font-medium text-indigo-700"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <ArrowUpWideNarrowIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setSortDirection("desc")}
                          className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
                            sortDirection === "desc"
                              ? "bg-indigo-50 font-medium text-indigo-700"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <ArrowDownWideNarrowIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="min-h-0 flex-1 overflow-auto border-t border-b">
            {isLoading ? (
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "5%" }} />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow className="border-none">
                    <TableHead className="text-xs text-black">File</TableHead>
                    <TableHead className="text-xs text-black">Model</TableHead>
                    <TableHead className="text-xs text-black">Type</TableHead>
                    <TableHead className="text-xs text-black">Date</TableHead>
                    <TableHead className="text-xs text-black"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-12">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 shrink-0" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-6" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : historyRows.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 p-8">
                <div className="space-y-2 text-center">
                  <p className="text-muted-foreground text-sm">
                    {debouncedSearchQuery
                      ? "No edits match your search."
                      : "No edits yet."}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Run an edit to see results here.
                  </p>
                </div>
              </div>
            ) : (
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "5%" }} />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow className="border-none">
                    <TableHead className="px-3 py-2 text-xs text-black">
                      File
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black">
                      Model
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black">
                      Type
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black">
                      Date
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.map((row) => {
                    const isDeleting = deletingRowKey === row.row_key;
                    const isLoadingEdit = loadingRowKey === row.row_key;
                    const hasLoadableEdit = !!row.edit_id;
                    return (
                      <TableRow
                        key={row.row_key}
                        className={`group h-12 ${
                          hasLoadableEdit
                            ? "hover:bg-muted/30 cursor-pointer"
                            : "cursor-not-allowed"
                        }`}
                        onClick={() => {
                          if (
                            hasLoadableEdit &&
                            !isDeleting &&
                            !isLoadingEdit
                          ) {
                            void handleEditClick(row);
                          }
                        }}
                      >
                        <TableCell className="px-3 text-xs whitespace-nowrap">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100">
                              {getFileIcon()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-block w-fit max-w-full truncate align-middle font-medium">
                                    {row.filename}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{row.filename}</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                          <span className="font-mono text-xs">
                            {row.model_name || "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                          <Badge
                            variant="secondary"
                            className={
                              row.edit_type === "template"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-emerald-100 text-emerald-800"
                            }
                          >
                            {row.edit_type === "template"
                              ? "Template"
                              : "Agent"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="px-3 text-right">
                          {canDeleteEdit && (
                            <Popover
                              open={openMenuId === row.row_key}
                              onOpenChange={(isOpen) =>
                                setOpenMenuId(isOpen ? row.row_key : null)
                              }
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  size="iconSm"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={
                                    isDeleting || isLoadingEdit || !row.edit_id
                                  }
                                >
                                  {isDeleting || isLoadingEdit ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <MoreVertical className="text-muted-foreground h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="end"
                                className="flex w-52 flex-col gap-1 p-2"
                              >
                                <button
                                  className="hover:bg-destructive/10 text-destructive flex items-center gap-2 rounded px-3 py-2 text-left text-xs disabled:opacity-50"
                                  onClick={(e) => handleDeleteClick(e, row)}
                                  disabled={!row.edit_id}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete edit</span>
                                </button>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex items-center justify-between p-4">
            <div className="text-muted-foreground text-xs">
              {historyRows.length > 0 &&
                `Showing ${historyRows.length} edit${historyRows.length !== 1 ? "s" : ""}`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="group px-2 text-xs"
                onClick={editsPrevPage}
                disabled={!pageIds.after || isLoading}
              >
                <ChevronLeft className="h-4 w-4 -translate-x-0.5 opacity-60 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:-translate-x-3 group-hover:opacity-0" />
                <ChevronLeft className="-ml-6 h-4 w-4 translate-x-2.5 opacity-0 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:-translate-x-0 group-hover:opacity-100" />
                Prev
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="group px-2 text-xs"
                onClick={editsNextPage}
                disabled={!pageIds.before || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4 opacity-60 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:translate-x-3 group-hover:opacity-0" />
                <ChevronRight className="-ml-6 h-4 w-4 -translate-x-2.5 opacity-0 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConfirmTarget !== null}
        onOpenChange={(isOpen) => !isOpen && setDeleteConfirmTarget(null)}
      >
        <AlertDialogContent className="gap-0 rounded-2xl border-none bg-gray-50 p-0 shadow-2xl">
          <div className="rounded-2xl bg-white shadow-xs">
            <AlertDialogHeader className="p-6 pb-4">
              <AlertDialogTitle className="text-lg font-medium text-slate-900">
                Delete edit
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this edit result? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-4">
            <AlertDialogCancel disabled={deletingRowKey !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingRowKey !== null}
              className="group before:transtion-opacity bg-destructive hover:bg-destructive ring-destructive relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-md text-left font-medium text-white shadow-[0_1px_theme(colors.white/0.07)_inset,0_1px_3px_theme(colors.gray.900/0.2)] ring-1 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-gradient-to-b before:from-white/20 before:opacity-50 before:duration-300 before:ease-[cubic-bezier(0.4,0.36,0,1)] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-md after:bg-gradient-to-b after:from-white/10 after:from-[46%] after:to-[54%] after:mix-blend-overlay hover:opacity-80 hover:before:opacity-100"
            >
              {deletingRowKey !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {historyError > 0 && <HistoryFetchErrorToast key={historyError} />}
    </>
  );
};

function HistoryFetchErrorToast() {
  useMountEffect(() => {
    toast.error("Failed to fetch edit history");
  });
  return null;
}
