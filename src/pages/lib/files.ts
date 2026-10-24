import { ACCEPTED_FILE_TYPES, MAX_FILE_BYTES, type AttachedFile, type Attachment } from "../api/types";

// Text files often arrive without a type, so they're also matched by extension.
const TEXT_EXTENSIONS = [".txt", ".md", ".csv"];

/** The file picker's `accept` list. */
export const ACCEPT = [...ACCEPTED_FILE_TYPES, ...TEXT_EXTENSIONS].join(",");

/** Whether a picked file is a type and size the attach button takes. */
export function canAttach(file: File) {
  const name = file.name.toLowerCase();
  const typeOk = ACCEPTED_FILE_TYPES.includes(file.type) || TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
  return typeOk && file.size <= MAX_FILE_BYTES;
}

/** Reads a picked file into the shape sendMessage takes. */
export async function toAttachment(file: File): Promise<Attachment> {
  return { name: file.name, type: file.type || "text/plain", size: file.size, data: await file.arrayBuffer() };
}

/** "PDF", "Image" or "Text", the label on a file chip. */
export function fileKind(file: AttachedFile) {
  if (file.type === "application/pdf") return "PDF";
  if (file.type.startsWith("image/")) return "Image";
  return "Text";
}
