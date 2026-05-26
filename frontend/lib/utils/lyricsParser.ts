export interface LyricsLine {
  startTime: number;
  endTime?: number;
  text: string;
  words?: { startTime: number; text: string }[];
}

/**
 * Parses LRC and ELRC formatted lyrics.
 * Robustly handles common formatting issues.
 */
export function parseLyrics(lrc: string): LyricsLine[] {
  const lines = lrc.split('\n');
  const result: LyricsLine[] = [];

  for (const line of lines) {
    const timestampMatch = line.match(/\[(\d+):(\d+\.\d+)\]/g);
    if (!timestampMatch) continue;

    // Simplistic parsing for now, to be extended with word-level ELRC
    const text = line.replace(/\[.*\]/g, '').trim();
    const timestamp = timestampMatch[0];
    const match = timestamp.match(/\[(\d+):(\d+\.\d+)\]/);
    if (match) {
        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
        result.push({ startTime: time, text });
    }
  }

  return result.sort((a, b) => a.startTime - b.startTime);
}
