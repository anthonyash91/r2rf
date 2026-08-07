import { describe, it, expect } from "vitest";
import { validateContentFilePath, validateQaScreenshotPath } from "@/lib/upload-handler.server";

describe("validateContentFilePath", () => {
  it("builds a path under uploads/{category}/{item}/{language}/ with the extension's byte limit", () => {
    const { path, maxBytes } = validateContentFilePath(
      "My Video.mp4",
      "health",
      "understanding-anxiety-a3f9",
      "english",
    );
    expect(path).toMatch(
      /^uploads\/health\/understanding-anxiety-a3f9\/english\/\d+-My_Video\.mp4$/,
    );
    expect(maxBytes).toBe(500 * 1024 * 1024);
  });

  it("builds a spanish-folder path", () => {
    const { path } = validateContentFilePath("audio.mp3", "health", "item-1", "spanish");
    expect(path).toMatch(/^uploads\/health\/item-1\/spanish\/\d+-audio\.mp3$/);
  });

  it("rejects a language that isn't english or spanish", () => {
    expect(() => validateContentFilePath("file.pdf", "health", "item-1", "french")).toThrow(
      /english.*spanish/i,
    );
    expect(() => validateContentFilePath("file.pdf", "health", "item-1", "")).toThrow(
      /english.*spanish/i,
    );
  });

  it("sanitizes path-separator characters out of the filename", () => {
    // Traversal is prevented by construction: '/' becomes '_', so the result
    // can never escape the intended folder regardless of filename content.
    const { path } = validateContentFilePath("../../secret.pdf", "health", "item-1", "english");
    expect(path).not.toContain("../");
    expect(path.startsWith("uploads/health/item-1/english/")).toBe(true);
  });

  it("sanitizes traversal/slash attempts in the category or item folder segments too", () => {
    const { path } = validateContentFilePath("file.pdf", "../../etc", "../../passwd", "english");
    expect(path).not.toContain("../");
    expect(path.startsWith("uploads/")).toBe(true);
    // both segments collapse to sanitized, non-empty values rather than escaping the prefix
    expect(path.split("/").length).toBe(5); // uploads / category / item / language / filename
  });

  it("falls back to safe defaults when category or item folder is empty", () => {
    const { path } = validateContentFilePath("file.pdf", "", "", "english");
    expect(path).toBe(path.match(/^uploads\/uncategorized\/misc\/english\/\d+-file\.pdf$/)?.[0]);
  });

  it("rejects a disallowed extension", () => {
    expect(() => validateContentFilePath("malware.exe", "health", "item-1", "english")).toThrow(
      /not allowed/,
    );
  });

  it("applies the correct per-extension size limit", () => {
    expect(validateContentFilePath("doc.pdf", "health", "item-1", "english").maxBytes).toBe(
      50 * 1024 * 1024,
    );
    expect(validateContentFilePath("photo.png", "health", "item-1", "english").maxBytes).toBe(
      20 * 1024 * 1024,
    );
  });
});

describe("validateQaScreenshotPath", () => {
  it("builds a path scoped to runId/testId", () => {
    const { path, maxBytes } = validateQaScreenshotPath("screenshot.png", "run-1", "1.1");
    expect(path).toMatch(/^qa-screenshots\/run-1\/1\.1\/\d+\.png$/);
    expect(maxBytes).toBe(20 * 1024 * 1024);
  });

  it("rejects a non-image extension", () => {
    expect(() => validateQaScreenshotPath("video.mp4", "run-1", "1.1")).toThrow(/image files/);
  });

  it("rejects a filename with no extension", () => {
    // filename.split(".").pop() returns the whole string when there's no dot,
    // so a dot-less filename is treated as an (invalid) extension and rejected
    // — matching the original getQaScreenshotUploadUrl behavior this replaced.
    expect(() => validateQaScreenshotPath("screenshot", "run-1", "1.1")).toThrow(/image files/);
  });
});
