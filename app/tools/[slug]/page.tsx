import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TOOLS, TOOLS_BY_SLUG } from "@/lib/tools";
import { ToolShell } from "@/components/tools/tool-shell";

/** One static page per tool for `output: 'export'` (design §2.4). */
export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOLS_BY_SLUG[slug];
  if (!tool) return { title: "myDocXtor" };
  return { title: `${tool.name} — myDocXtor`, description: tool.description };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = TOOLS_BY_SLUG[slug];
  if (!tool) notFound();
  return <ToolShell slug={slug} />;
}
