import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from "pdf-lib";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * PDF forms (design §3). pdf-lib's form API: list existing AcroForm fields,
 * fill values, and optionally flatten (bake values into page content so they
 * are no longer editable). Framework-free + unit-testable.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

export type FieldKind = "text" | "checkbox" | "radio" | "dropdown" | "optionlist" | "button" | "unknown";

export interface FormField {
  name: string;
  kind: FieldKind;
  /** Current value (text) or checked state. */
  value?: string | boolean;
  /** For radio/dropdown: selectable options. */
  options?: string[];
}

async function load(data: Bytes): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(data instanceof Uint8Array ? data : new Uint8Array(data));
  } catch (err) {
    throw new AppError("CorruptFile", undefined, { cause: err });
  }
}

/** List AcroForm fields with their kind, value, and options. */
export async function listFields(data: Bytes): Promise<FormField[]> {
  const doc = await load(data);
  const form = doc.getForm();
  const fields = form.getFields();
  return fields.map((f) => {
    const name = f.getName();
    if (f instanceof PDFTextField) return { name, kind: "text", value: f.getText() ?? "" };
    if (f instanceof PDFCheckBox) return { name, kind: "checkbox", value: f.isChecked() };
    if (f instanceof PDFRadioGroup)
      return { name, kind: "radio", value: f.getSelected() ?? "", options: f.getOptions() };
    if (f instanceof PDFDropdown)
      return { name, kind: "dropdown", value: (f.getSelected() ?? [])[0] ?? "", options: f.getOptions() };
    return { name, kind: "unknown" };
  });
}

export interface FillValues {
  [fieldName: string]: string | boolean;
}

/** Fill field values and optionally flatten. Returns new PDF bytes. */
export async function fillForm(
  data: Bytes,
  values: FillValues,
  flatten: boolean,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const doc = await load(data);
  const form = doc.getForm();
  const names = Object.keys(values);
  for (let i = 0; i < names.length; i++) {
    if (signal?.aborted) throw new AppError("Cancelled");
    const name = names[i]!;
    const value = values[name]!;
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    if (field instanceof PDFTextField) field.setText(String(value));
    else if (field instanceof PDFCheckBox) value ? field.check() : field.uncheck();
    else if (field instanceof PDFRadioGroup && typeof value === "string" && value) field.select(value);
    else if (field instanceof PDFDropdown && typeof value === "string" && value) field.select(value);
    onProgress({ value: (i + 1) / names.length, label: `Field ${i + 1} of ${names.length}` });
  }
  if (flatten) form.flatten();
  return doc.save();
}
