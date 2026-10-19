import Link from "next/link";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  toolsByCategory,
  type ToolDef,
} from "@/lib/tools";

function ToolCard({ tool }: { tool: ToolDef }) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/tools/${tool.slug}/`}
      className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-transform duration-175 ease-out-soft hover:-translate-y-0.5 hover:border-primary/40 focus-visible:-translate-y-0.5"
    >
      <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="font-medium">{tool.name}</span>
      <span className="text-sm text-muted-foreground">{tool.description}</span>
    </Link>
  );
}

/** Home tool grid grouped by category (UI steering §3.2). */
export function ToolGrid() {
  return (
    <div className="flex flex-col gap-10">
      {CATEGORY_ORDER.map((category) => {
        const tools = toolsByCategory(category);
        if (tools.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <h2
              id={`cat-${category}`}
              className="mb-4 text-lg font-semibold tracking-tight"
            >
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
