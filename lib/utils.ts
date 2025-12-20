export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function getBestThumbnail(thumbnails: Array<{ url?: string; width?: number; height?: number }> | undefined): string {
  if (!thumbnails || thumbnails.length === 0) return '';

  // Prefer medium-quality thumbnails (336x188 hqdefault) for faster loading
  const TARGET_WIDTH = 336;
  const TARGET_HEIGHT = 188;

  const youtubeThumbnails = [...thumbnails]
    .filter(t => t.url && t.url.includes('i.ytimg.com/vi'));

  // First, try to find exact match for 336x188
  const exactMatch = youtubeThumbnails.find(
    t => t.width === TARGET_WIDTH && t.height === TARGET_HEIGHT
  );
  if (exactMatch?.url) return exactMatch.url;

  // Find thumbnail closest to target size
  const sorted = youtubeThumbnails.sort((a, b) => {
    const aDiff = Math.abs((a.width || 0) - TARGET_WIDTH) + Math.abs((a.height || 0) - TARGET_HEIGHT);
    const bDiff = Math.abs((b.width || 0) - TARGET_WIDTH) + Math.abs((b.height || 0) - TARGET_HEIGHT);
    return aDiff - bDiff;
  });

  if (sorted.length > 0 && sorted[0].url) {
    return sorted[0].url;
  }

  // Fallback to first thumbnail
  return thumbnails[0]?.url || '';
}
