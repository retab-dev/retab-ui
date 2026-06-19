"use client";

import * as React from "react";

import type { FileSystemFolderTask } from "./file-system-folder-task";
import type { FileSystemKernelCommand } from "./file-system-kernel";
import type { FileSystemFileEntry, FileSystemProps } from "./file-system-types";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type FileSystemKernelCallbacks = {
  onFileCommand: (file: FileSystemFileEntry) => void;
  onPathChange: FileSystemProps["onPathChange"];
  onQueryChange: FileSystemProps["onQueryChange"];
  onSelectionChange: FileSystemProps["onSelectionChange"];
  onViewChange: FileSystemProps["onViewChange"];
};

export function useFileSystemKernelCommandEffects({
  callbacks,
  consumeCommands,
  flushVersion,
  folderTask,
}: {
  callbacks: FileSystemKernelCallbacks;
  consumeCommands: () => FileSystemKernelCommand[];
  flushVersion: number;
  folderTask: FileSystemFolderTask;
}) {
  useKeyedMountEffect(
    joinEffectKey([callbacks, consumeCommands, flushVersion, folderTask]),
    () => {
      const commands = consumeCommands();

      if (!commands.length) return;

      for (const command of commands) {
        switch (command.type) {
          case "callback.pathChanged":
            callbacks.onPathChange?.(command.path);
            break;
          case "callback.queryChanged":
            callbacks.onQueryChange?.(command.query);
            break;
          case "callback.viewChanged":
            callbacks.onViewChange?.(command.view);
            break;
          case "callback.selectionChanged":
            callbacks.onSelectionChange?.(command.entry);
            break;
          case "file.open":
            callbacks.onFileCommand(command.file);
            break;
          case "folder.ensure":
            folderTask.runFolderCommand(command);
            break;
        }
      }
    },
  );
}
