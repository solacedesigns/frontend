import { describe, it, expect } from "vitest";
import { stripLrcTimestamps } from "./lrcParser";

describe("stripLrcTimestamps", () => {
  it("returns null for empty input", () => {
    expect(stripLrcTimestamps(null)).toBeNull();
    expect(stripLrcTimestamps("")).toBeNull();
  });

  it("removes timestamps and keeps the lines in order", () => {
    const lrc = "[00:12.30]First line\n[00:15.00]Second line\n[01:02.50]Third";
    expect(stripLrcTimestamps(lrc)).toBe("First line\nSecond line\nThird");
  });

  it("leaves plain lyrics untouched", () => {
    const plain = "First line\nSecond line";
    expect(stripLrcTimestamps(plain)).toBe(plain);
  });

  it("drops the timed blank lines that mark instrumental breaks", () => {
    // The viewer renders these as countdown breaks, which only make sense while
    // following along; without a clock they would show as gaps in the text.
    const lrc = "[00:01.00]Sing\n[00:10.00]\n[00:30.00]Sing again";
    expect(stripLrcTimestamps(lrc)).toBe("Sing\nSing again");
  });

  it("drops LRC id tags rather than showing them as lyrics", () => {
    const lrc = "[ar:Some Artist]\n[ti:Some Song]\n[00:01.00]Actual words";
    expect(stripLrcTimestamps(lrc)).toBe("Actual words");
  });

  it("returns null when nothing but tags and timestamps remain", () => {
    expect(stripLrcTimestamps("[ar:Nobody]\n[00:01.00]\n")).toBeNull();
  });

  it("leaves no timestamp the viewer could pick up as a cue to scroll", () => {
    // This is the whole point of the helper: LyricsViewer decides to follow
    // along by testing the text for /\[\d+:\d+[.:]?\d*\]/.
    const out = stripLrcTimestamps("[00:12.30]Line\n[00:15]Another") ?? "";
    expect(/\[\d+:\d+[.:]?\d*\]/.test(out)).toBe(false);
  });
});
