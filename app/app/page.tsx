import type { Metadata } from "next";
// import { HomeDropzone } from "@/components/shell/home-dropzone";
import { ToolGrid } from "@/components/shell/tool-grid";

export const metadata: Metadata = {
  title: "All tools — myDocXtor",
  description:
    "Every PDF tool plus an AI background remover, all running in your browser. Drop a file to get started.",
};

export default function AppHomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-10 flex flex-col gap-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[40px] sm:leading-tight">
            Every PDF tool. Nothing leaves your device.
          </h1>
          <p className="mt-3 text-muted-foreground">
            A complete PDF toolkit plus an AI background remover. Every file is
            processed inside your browser — no upload, ever.
          </p>
        </div>
        {/* Disable as in future enable and then fix the context issue */}
        {/* <HomeDropzone /> */}
      </section>
      <ToolGrid />
    </div>
  );
}
