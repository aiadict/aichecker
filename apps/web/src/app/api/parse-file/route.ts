import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { ParseFileResponse } from "@ai-checker/shared-types";
import { getAuthenticatedUser } from "@/lib/auth";

// Not a credit-costing action (only the eventual /api/checks call is) — so
// no anonymous_trials/consume logic here, same reasoning /api/feedback/*
// use for not requiring identity. But still gated on the same "signed in
// OR has a device id" signal /api/checks itself requires, rather than
// being a fully open unauthenticated endpoint anyone could hit to burn
// server CPU parsing arbitrary files for free.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  const deviceId = req.headers.get("x-device-id");
  if (!user && !deviceId) {
    return NextResponse.json<ParseFileResponse>({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json<ParseFileResponse>({ ok: false, error: "unsupported_type" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json<ParseFileResponse>({ ok: false, error: "file_too_large" }, { status: 400 });
  }

  // Extension, not just MIME type — browsers/OSes report .docx with a
  // range of inconsistent Content-Types (and none at all for some), but
  // the extension is exactly what the extension-side <input accept=...>
  // and this same allow-list already agree on.
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

  try {
    if (ext === ".txt") {
      const text = await file.text();
      return NextResponse.json<ParseFileResponse>({ ok: true, text });
    }

    if (ext === ".docx") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { value: text } = await mammoth.extractRawText({ buffer });
      if (!text.trim()) {
        return NextResponse.json<ParseFileResponse>({ ok: false, error: "unrecognized_text" });
      }
      return NextResponse.json<ParseFileResponse>({ ok: true, text });
    }

    if (ext === ".pdf") {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buffer);
      const { text: rawText } = await extractText(pdf, { mergePages: true });
      // PDF text layers store soft line-wraps as real "\n" characters — left
      // alone, that splits words mid-sentence the moment a line happened to
      // wrap in the original layout (confirmed live: "...for th\ne AI
      // checker..."). A blank line is a real paragraph break worth keeping;
      // a lone "\n" is a wrap artifact, joined back into a space instead.
      const text = rawText.replace(/([^\n])\n(?!\n)([^\n])/g, "$1 $2");
      if (!text.trim()) {
        // Most commonly a scanned/image-only PDF with no embedded text
        // layer — nothing to extract, not an error worth logging.
        return NextResponse.json<ParseFileResponse>({ ok: false, error: "unrecognized_text" });
      }
      return NextResponse.json<ParseFileResponse>({ ok: true, text });
    }

    if (ext === ".doc") {
      // Legacy binary format, not zip/XML like .docx — mammoth can't read
      // it, and a reliable parser is enough extra complexity that we're
      // deliberately not supporting it yet rather than shipping something
      // unreliable. See BUILD-PLAYBOOK/architecture notes on this call.
      return NextResponse.json<ParseFileResponse>({ ok: false, error: "legacy_doc_unsupported" });
    }

    return NextResponse.json<ParseFileResponse>({ ok: false, error: "unsupported_type" }, { status: 400 });
  } catch (err) {
    console.error(`Failed to parse uploaded file (${ext})`, err);
    // A malformed/corrupted file (or one that only claims its extension)
    // reads the same to the user as "we couldn't find any text" — no
    // reason to expose the parser's own internal error.
    return NextResponse.json<ParseFileResponse>({ ok: false, error: "unrecognized_text" });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
