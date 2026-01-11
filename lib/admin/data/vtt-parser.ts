/**
 * VTT (WebVTT) Parser Utility
 * Parses VTT subtitle files into structured transcript segments
 */

export interface TranscriptSegment {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  text: string;
}

/**
 * Parse a timestamp string (HH:MM:SS.mmm or MM:SS.mmm) to seconds
 */
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.trim().split(':');
  if (parts.length === 3) {
    // HH:MM:SS.mmm
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // MM:SS.mmm
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Clean VTT text by removing timing tags and extra whitespace
 * VTT can contain inline timing like: <00:00:00.560><c> word</c>
 */
function cleanVttText(text: string): string {
  return (
    text
      // Remove timing tags like <00:00:00.560>
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
      // Remove <c> and </c> tags
      .replace(/<\/?c>/g, '')
      // Remove position/alignment info
      .replace(/align:\w+/g, '')
      .replace(/position:\d+%/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Find word-level overlap between end of text1 and start of text2
 * Returns the number of overlapping words
 */
function findWordOverlap(text1: string, text2: string): number {
  const words1 = text1.split(/\s+/).filter((w) => w.length > 0);
  const words2 = text2.split(/\s+/).filter((w) => w.length > 0);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Try to find where words2 starts within the end of words1
  const maxOverlap = Math.min(words1.length, words2.length);
  for (let overlapLen = maxOverlap; overlapLen > 0; overlapLen--) {
    const endOfText1 = words1.slice(-overlapLen).join(' ').toLowerCase();
    const startOfText2 = words2.slice(0, overlapLen).join(' ').toLowerCase();
    if (endOfText1 === startOfText2) {
      return overlapLen;
    }
  }
  return 0;
}

/**
 * Parse VTT content into transcript segments
 * Handles YouTube's "rolling caption" format where each cue shows accumulated text
 * Preserves original timing while deduplicating text
 */
export function parseVtt(vttContent: string): TranscriptSegment[] {
  const lines = vttContent.split('\n');
  const segments: TranscriptSegment[] = [];

  // Track all text we've seen to detect duplicates
  const seenTexts = new Set<string>();
  // Track accumulated text to detect subsets and overlaps
  let accumulatedText = '';

  let i = 0;
  let segmentId = 0;

  // Skip header (WEBVTT and metadata)
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for timestamp line (contains -->)
    if (line.includes('-->')) {
      const timestampMatch = line.match(
        /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
      );

      if (timestampMatch) {
        const startTime = parseTimestamp(timestampMatch[1]);
        const endTime = parseTimestamp(timestampMatch[2]);

        // Collect text lines until empty line
        const textLines: string[] = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i]);
          i++;
        }

        const rawText = textLines.join(' ');
        const cleanedText = cleanVttText(rawText);

        if (cleanedText) {
          // Check for duplicates
          if (seenTexts.has(cleanedText)) {
            // Exact duplicate - skip
            i++;
            continue;
          }

          // Check if this text is a subset of accumulated text
          if (accumulatedText.includes(cleanedText)) {
            // Subset of what we've seen - skip
            i++;
            continue;
          }

          // Check if this extends the accumulated text
          if (cleanedText.startsWith(accumulatedText) && accumulatedText.length > 0) {
            // Extract only the new part
            const newPart = cleanedText.slice(accumulatedText.length).trim();
            if (newPart) {
              segments.push({
                id: `seg-${segmentId++}`,
                startTime,
                endTime,
                text: newPart,
              });
              seenTexts.add(newPart);
            }
            accumulatedText = cleanedText;
            seenTexts.add(cleanedText);
            i++;
            continue;
          }

          // Check for word-level overlap with accumulated text
          const overlap = findWordOverlap(accumulatedText, cleanedText);
          if (overlap > 0) {
            // Extract only the non-overlapping part
            const words = cleanedText.split(/\s+/).filter((w) => w.length > 0);
            const newPart = words.slice(overlap).join(' ');
            if (newPart && !seenTexts.has(newPart)) {
              segments.push({
                id: `seg-${segmentId++}`,
                startTime,
                endTime,
                text: newPart,
              });
              seenTexts.add(newPart);
              accumulatedText = accumulatedText + ' ' + newPart;
            }
            i++;
            continue;
          }

          // Genuinely new content - no overlap detected
          segments.push({
            id: `seg-${segmentId++}`,
            startTime,
            endTime,
            text: cleanedText,
          });
          seenTexts.add(cleanedText);
          accumulatedText = cleanedText;
        }
      }
    }
    i++;
  }

  return segments;
}

/**
 * Merge adjacent segments to create more readable paragraphs
 * Segments within `gapThreshold` seconds are merged together
 */
export function mergeSegments(
  segments: TranscriptSegment[],
  gapThreshold: number = 2.0
): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    const gap = next.startTime - current.endTime;

    if (gap <= gapThreshold) {
      // Merge with current
      current.endTime = next.endTime;
      current.text = current.text + ' ' + next.text;
    } else {
      // Start new segment
      merged.push(current);
      current = { ...next, id: `merged-${merged.length}` };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Format seconds to [MM:SS] or [H:MM:SS] timestamp format for AI consumption
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `[${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
  }
  return `[${mins}:${secs.toString().padStart(2, '0')}]`;
}

/**
 * Parse VTT content to text with inline timestamps for AI consumption.
 * Format: "[0:30] mix the ingredients [1:15] heat the pan"
 *
 * Timestamps are included at the start of each segment, allowing the AI
 * to understand when things happen in the video and output accurate timestamps.
 *
 * @param vttContent - Raw VTT file content, or pre-formatted timestamped text with TIMESTAMPED_TEXT: prefix
 * @returns Text with inline [MM:SS] timestamps
 */
export function parseVttToTimestampedText(vttContent: string): string {
  // Handle pre-formatted timestamped text from Lambda format
  // This is already in the correct format with timestamps
  if (vttContent.startsWith('TIMESTAMPED_TEXT:')) {
    return vttContent.slice('TIMESTAMPED_TEXT:'.length);
  }

  const segments = parseVtt(vttContent);
  if (segments.length === 0) return '';

  const parts: string[] = [];

  for (const segment of segments) {
    const timestamp = formatTimestamp(segment.startTime);
    parts.push(`${timestamp} ${segment.text}`);
  }

  return parts.join(' ');
}

/**
 * Parse VTT content to plain text with paragraph breaks based on timing gaps.
 *
 * @param vttContent - Raw VTT file content
 * @returns Plain text with paragraph breaks for pauses >= 2 seconds
 */
export function parseVttToText(vttContent: string): string {
  const segments = parseVtt(vttContent);
  if (segments.length === 0) return '';

  let result = segments[0].text;

  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    const gap = curr.startTime - prev.endTime;

    // Add double newline for pauses >= 2 seconds
    // Add single newline for pauses >= 1 second
    // Otherwise add space
    if (gap >= 2) {
      result += '\n\n';
    } else if (gap >= 1) {
      result += '\n';
    } else {
      result += ' ';
    }

    result += curr.text;
  }

  // Final cleanup to remove any multiple spaces
  result = result.replace(/ +/g, ' ');

  return result;
}
