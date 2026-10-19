"use client";

import * as React from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, toolsByCategory } from "@/lib/tools";
import { Button } from "@/components/ui/button";

/** Fuzzy command palette across all tools (UI steering §3.4). */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (slug: string) => {
    setOpen(false);
    router.push(`/tools/${slug}/`);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full max-w-md justify-between text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Search tools"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" />
          Search tools…
        </span>
        <kbd className="hidden rounded border border-border px-1.5 font-mono text-xs sm:inline">
          ⌘K
        </kbd>
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed left-1/2 top-[20%] z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
            aria-label="Command palette"
          >
            <Dialog.Title className="sr-only">Search tools</Dialog.Title>
            <Command className="[&_[cmdk-input]]:outline-none" loop>
              <div className="flex items-center gap-2 border-b border-border px-4">
                <Search className="size-4 text-muted-foreground" />
                <Command.Input
                  placeholder="Search tools and actions…"
                  className="h-12 w-full bg-transparent text-sm placeholder:text-muted-foreground"
                />
              </div>
              <Command.List className="max-h-80 overflow-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No matching tools.
                </Command.Empty>
                {CATEGORY_ORDER.filter((category) => category !== "image").map(
                  (category) => (
                  <Command.Group
                    key={category}
                    heading={CATEGORY_LABELS[category]}
                    className="px-1 py-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                  >
                    {toolsByCategory(category).map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <Command.Item
                          key={tool.slug}
                          value={`${tool.name} ${tool.description}`}
                          onSelect={() => go(tool.slug)}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-muted"
                        >
                          <Icon className="size-4 text-primary" />
                          <span>{tool.name}</span>
                          <span className="ml-auto truncate text-xs text-muted-foreground">
                            {tool.description}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                  ),
                )}
              </Command.List>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
