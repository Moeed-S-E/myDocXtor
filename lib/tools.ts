import type { LucideIcon } from "lucide-react";
import {
  Combine,
  Scissors,
  Trash2,
  FileOutput,
  LayoutGrid,
  RotateCw,
  Crop,
  ScanLine,
  Minimize2,
  ScanText,
  Image as ImageIcon,
  Globe,
  FileImage,
  FileText,
  Presentation,
  Sheet,
  Hash,
  Stamp,
  FormInput,
  GitCompare,
  Copy,
  Lock,
  Unlock,
  PenTool,
  SquareSlash,
  // Eraser, // used by the disabled Background remover tool
  BadgeCheck,
} from "lucide-react";

export type ToolCategory =
  | "organize"
  | "optimize"
  | "to-pdf"
  | "from-pdf"
  | "edit"
  | "security"
  | "image";

export type ToolPriority = "P0" | "P1" | "P2";

export interface ToolDef {
  /** URL slug under /tools/[slug]. */
  slug: string;
  /** Short verb-first display name. */
  name: string;
  /** One-line description for cards and palette. */
  description: string;
  category: ToolCategory;
  priority: ToolPriority;
  icon: LucideIcon;
  /** Accepted input, used by the home dropzone to suggest tools. */
  accepts: ("pdf" | "image")[];
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  organize: "Organize",
  optimize: "Optimize & repair",
  "to-pdf": "Convert to PDF",
  "from-pdf": "Convert from PDF",
  edit: "Edit",
  security: "Security & signing",
  image: "Image tools",
};

/** Ordered for display on the home page. */
export const CATEGORY_ORDER: ToolCategory[] = [
  "organize",
  "optimize",
  "to-pdf",
  "from-pdf",
  "edit",
  "security",
  "image",
];

export const TOOLS: ToolDef[] = [
  // Organize
  { slug: "merge", name: "Merge PDF", description: "Combine PDFs into one, drag to reorder.", category: "organize", priority: "P0", icon: Combine, accepts: ["pdf"] },
  { slug: "split", name: "Split PDF", description: "Split by ranges, every N pages, or bookmarks.", category: "organize", priority: "P0", icon: Scissors, accepts: ["pdf"] },
  { slug: "remove-pages", name: "Remove pages", description: "Delete selected pages and export.", category: "organize", priority: "P0", icon: Trash2, accepts: ["pdf"] },
  { slug: "extract-pages", name: "Extract pages", description: "Pull out pages or ranges as a new PDF.", category: "organize", priority: "P0", icon: FileOutput, accepts: ["pdf"] },
  { slug: "organize", name: "Organize pages", description: "Reorder, rotate, duplicate, delete, insert blanks.", category: "organize", priority: "P0", icon: LayoutGrid, accepts: ["pdf"] },
  { slug: "rotate", name: "Rotate PDF", description: "Rotate all or selected pages.", category: "organize", priority: "P0", icon: RotateCw, accepts: ["pdf"] },
  { slug: "crop", name: "Crop PDF", description: "Draw a crop box or set numeric margins.", category: "organize", priority: "P1", icon: Crop, accepts: ["pdf"] },
  { slug: "scan", name: "Scan to PDF", description: "Capture or upload photos, deskew, compile.", category: "organize", priority: "P1", icon: ScanLine, accepts: ["image"] },

  // Optimize & repair
  { slug: "compress", name: "Compress PDF", description: "Shrink with light, balanced, or strong presets.", category: "optimize", priority: "P0", icon: Minimize2, accepts: ["pdf"] },
  { slug: "ocr", name: "OCR PDF", description: "Add a searchable invisible text layer.", category: "optimize", priority: "P1", icon: ScanText, accepts: ["pdf"] },

  // Convert to PDF
  { slug: "image-to-pdf", name: "Image to PDF", description: "JPG, PNG, WebP, HEIC into a PDF.", category: "to-pdf", priority: "P0", icon: ImageIcon, accepts: ["image"] },
  { slug: "html-to-pdf", name: "HTML to PDF", description: "Paste or upload HTML to convert.", category: "to-pdf", priority: "P1", icon: Globe, accepts: [] },

  // Convert from PDF
  { slug: "pdf-to-jpg", name: "PDF to JPG", description: "Export pages as images with a DPI picker.", category: "from-pdf", priority: "P0", icon: FileImage, accepts: ["pdf"] },
  { slug: "pdf-to-word", name: "PDF to Word", description: "Reflowed, editable .docx.", category: "from-pdf", priority: "P1", icon: FileText, accepts: ["pdf"] },
  { slug: "pdf-to-ppt", name: "PDF to PowerPoint", description: "One slide per page.", category: "from-pdf", priority: "P1", icon: Presentation, accepts: ["pdf"] },
  { slug: "pdf-to-excel", name: "PDF to Excel", description: "Detect tables into sheets.", category: "from-pdf", priority: "P1", icon: Sheet, accepts: ["pdf"] },
  { slug: "pdf-to-markdown", name: "PDF to Markdown", description: "Headings, lists, tables, images.", category: "from-pdf", priority: "P1", icon: FileText, accepts: ["pdf"] },

  // Edit
  { slug: "edit", name: "Edit PDF", description: "Text, shapes, highlights, freehand, images.", category: "edit", priority: "P1", icon: PenTool, accepts: ["pdf"] },
  { slug: "page-numbers", name: "Add page numbers", description: "Position, format, start number, range.", category: "edit", priority: "P0", icon: Hash, accepts: ["pdf"] },
  { slug: "watermark", name: "Add watermark", description: "Text or image, opacity, rotation, tiling.", category: "edit", priority: "P0", icon: Stamp, accepts: ["pdf"] },
  { slug: "forms", name: "PDF forms", description: "Fill, flatten, and create basic fields.", category: "edit", priority: "P1", icon: FormInput, accepts: ["pdf"] },
  { slug: "compare", name: "Compare PDF", description: "Text diff and visual overlay.", category: "edit", priority: "P1", icon: GitCompare, accepts: ["pdf"] },
  { slug: "copy", name: "Copy PDF", description: "Duplicate with a new name, optional clean metadata.", category: "edit", priority: "P2", icon: Copy, accepts: ["pdf"] },

  // Security & signing
  { slug: "protect", name: "Protect PDF", description: "AES-256 password and permissions.", category: "security", priority: "P0", icon: Lock, accepts: ["pdf"] },
  { slug: "unlock", name: "Unlock PDF", description: "Remove a password you know.", category: "security", priority: "P0", icon: Unlock, accepts: ["pdf"] },
  { slug: "sign", name: "Sign PDF", description: "Draw, type, or upload a signature.", category: "security", priority: "P0", icon: PenTool, accepts: ["pdf"] },
  { slug: "redact", name: "Redact PDF", description: "Permanently remove text and image data.", category: "security", priority: "P0", icon: SquareSlash, accepts: ["pdf"] },
  { slug: "cert-sign", name: "Certificate sign", description: "Visual signature attested by a PKCS#12 certificate.", category: "security", priority: "P2", icon: BadgeCheck, accepts: ["pdf"] },

  // Image tools
  // Background remover is temporarily DISABLED (not working). Re-enable by
  // uncommenting this entry and its dispatcher mapping in tool-shell.tsx.
  // { slug: "background-remover", name: "Background remover", description: "Remove an image background on-device.", category: "image", priority: "P0", icon: Eraser, accepts: ["image"] },
];

export const TOOLS_BY_SLUG: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t]),
);

export function toolsByCategory(category: ToolCategory): ToolDef[] {
  return TOOLS.filter((t) => t.category === category);
}
