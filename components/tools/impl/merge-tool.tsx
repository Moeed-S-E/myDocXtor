"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUp, ArrowDown } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { ToolWorkspace, type ToolRenderArgs, type LoadedFile } from "../tool-workspace";
import { usePdfLibRunner } from "../use-pdf-lib-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";

function SortableFile({
  item,
  index,
  count,
  onRemove,
  onMove,
}: {
  item: LoadedFile;
  index: number;
  count: number;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2"
    >
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-6"
          aria-label={`Move ${item.file.name} up`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-6"
          aria-label={`Move ${item.file.name} down`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-3" />
        </Button>
      </div>
      <div className="flex-1">
        <FileCard
          name={item.file.name}
          size={item.file.size}
          onRemove={onRemove}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      </div>
    </div>
  );
}

export function MergeTool() {
  const tool = TOOLS_BY_SLUG["merge"]!;
  const runner = usePdfLibRunner();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const main = ({ files, setFiles, removeFile }: ToolRenderArgs) => {
    const onDragEnd = (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      setFiles((prev) => {
        const from = prev.findIndex((f) => f.id === active.id);
        const to = prev.findIndex((f) => f.id === over.id);
        return arrayMove(prev, from, to);
      });
    };
    const move = (index: number, dir: -1 | 1) =>
      setFiles((prev) => arrayMove(prev, index, index + dir));

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {files.map((item, i) => (
              <SortableFile
                key={item.id}
                item={item}
                index={i}
                count={files.length}
                onRemove={() => removeFile(item.id)}
                onMove={(dir) => move(i, dir)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      const inputBytes = files.reduce((s, f) => s + f.file.size, 0);
      const bytesList = await Promise.all(files.map((f) => fileToBytes(f.file)));
      try {
        const out = await runner.run("merge", [bytesList]);
        setResult({
          outputs: [{ bytes: out, blob: bytesToPdfBlob(out), filename: "merged.pdf" }],
          inputBytes,
        });
      } catch {
        /* error surfaced via runner.error */
      }
    };
    return (
      <>
        <p className="text-sm text-muted-foreground">
          Drag to reorder. Files merge top to bottom.
        </p>
        <Button onClick={run} disabled={files.length < 2}>
          Merge PDFs
        </Button>
      </>
    );
  };

  return (
    <ToolWorkspace
      tool={tool}
      multiple
      status={runner.status}
      progress={runner.progress}
      error={runner.error}
      onCancel={runner.cancel}
      onReset={runner.reset}
      renderMain={main}
      renderOptions={options}
    />
  );
}
