export interface ParsedLyric {
  time: number;
  text: string;
}

/**
 * Parse a single LRC line like "[00:29.79] Some lyric text" into {time, text}.
 */
export const parseLrcLine = (line: string): ParsedLyric => {
  const match = line.match(/\[(\d+):(\d+)([.:]\d+)?\](.*)/);
  if (match) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    let milliseconds = 0;
    if (match[3]) {
      const decimalPart = match[3].replace(/[.:]/, ".");
      milliseconds = Math.round(parseFloat(decimalPart) * 1000);
    }
    const timeMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
    const time = timeMs / 1000;
    return { time, text: match[4].trim() || " " };
  }
  return { time: 0, text: line.trim() || " " };
};

// LRC ID tags such as [ar:Artist] carry no lyric text. The server strips them,
// but they are cheap to recognise and would otherwise read as a lyric line.
const LRC_ID_TAG = /^\[[a-zA-Z#][^\]]*\]$/;

/**
 * Drop the [mm:ss.xx] tags from LRC text, leaving the lyric lines in order.
 *
 * The lyrics viewer decides whether to follow along by looking for timestamps in
 * the text it is handed, so removing them is how a caller says "show these, but
 * do not scroll". Live radio needs exactly that: the lyrics are for the song on
 * air, while the player's clock counts the endless stream it arrived in, so
 * timed lines would be scrolled against the wrong reference.
 */
export const stripLrcTimestamps = (lrc: string | null): string | null => {
  if (!lrc) return null;
  const lines = lrc
    .split("\n")
    .filter((line) => !LRC_ID_TAG.test(line.trim()))
    .map((line) => parseLrcLine(line).text.trim())
    .filter((text) => text.length > 0);
  return lines.length > 0 ? lines.join("\n") : null;
};
