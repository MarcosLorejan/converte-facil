import { describe, expect, it } from "vitest";
import { joinPath, stemFromPath } from "./pathHelpers";

describe("stemFromPath", () => {
  it("strips the final extension", () => {
    expect(stemFromPath("C:\\Users\\me\\report.docx")).toBe("report");
    expect(stemFromPath("/home/me/photo.PNG")).toBe("photo");
  });

  it("keeps names without an extension", () => {
    expect(stemFromPath("C:\\Users\\me\\README")).toBe("README");
  });

  it("only strips the last extension", () => {
    expect(stemFromPath("archive.tar.gz")).toBe("archive.tar");
  });
});

describe("joinPath", () => {
  it("uses backslash when the directory looks Windows-style", () => {
    expect(joinPath("C:\\Users\\me\\out", "a.png")).toBe(
      "C:\\Users\\me\\out\\a.png",
    );
  });

  it("uses forward slash for POSIX-style directories", () => {
    expect(joinPath("/tmp/out", "a.png")).toBe("/tmp/out/a.png");
  });

  it("does not double an existing trailing separator", () => {
    expect(joinPath("C:\\Users\\me\\out\\", "a.png")).toBe(
      "C:\\Users\\me\\out\\a.png",
    );
    expect(joinPath("/tmp/out/", "a.png")).toBe("/tmp/out/a.png");
  });
});
