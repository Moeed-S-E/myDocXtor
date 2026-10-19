/**
 * Typed error system (design.md §7). Each error maps to a plain-language UI
 * message and a recovery next-step (R-ERR-1). Engines throw these; the UI
 * renders `toUserMessage()`.
 */
export type AppErrorKind =
  | "PasswordRequired"
  | "WrongPassword"
  | "CorruptFile"
  | "UnsupportedFeature"
  | "OutOfMemory"
  | "Cancelled"
  | "Unknown";

export class AppError extends Error {
  readonly kind: AppErrorKind;
  constructor(kind: AppErrorKind, message?: string, options?: ErrorOptions) {
    super(message ?? kind, options);
    this.name = "AppError";
    this.kind = kind;
  }
}

export interface UserMessage {
  title: string;
  /** What the user can do next. */
  nextStep: string;
}

export function toUserMessage(error: unknown): UserMessage {
  const kind: AppErrorKind = error instanceof AppError ? error.kind : "Unknown";
  switch (kind) {
    case "PasswordRequired":
      return {
        title: "This PDF is password protected.",
        nextStep: "Enter the password to continue.",
      };
    case "WrongPassword":
      return {
        title: "That password didn't work.",
        nextStep: "Check for typos and try again. We never guess passwords.",
      };
    case "CorruptFile":
      return {
        title: "This file looks damaged.",
        nextStep: "Try the Repair PDF tool, or re-export the original.",
      };
    case "UnsupportedFeature":
      return {
        title: "This file uses a feature we can't handle yet.",
        nextStep: "Try a different file or let us know what you expected.",
      };
    case "OutOfMemory":
      return {
        title: "This file is too large for your device's memory.",
        nextStep: "Split it into smaller parts first, then try again.",
      };
    case "Cancelled":
      return {
        title: "Operation cancelled.",
        nextStep: "You can start again whenever you're ready.",
      };
    default:
      return {
        title: "Something went wrong.",
        nextStep: "Try again. If it keeps happening, try a different file.",
      };
  }
}
