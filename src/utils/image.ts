const WIKIMEDIA_STANDARD_WIDTHS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];

function getStandardWikimediaWidth(width: number): number {
  const stdWidth = WIKIMEDIA_STANDARD_WIDTHS.find(w => w >= width);
  return stdWidth || 3840;
}

/**
 * Utility to parse and optimize image URLs, specifically resizing Unsplash
 * and Wikipedia thumbnail images for thumbnails or previews to improve performance.
 */
export function getOptimizedImageUrl(url: string | undefined, width: number): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Unsplash image optimization
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const u = new URL(trimmed);
      u.searchParams.set('w', width.toString());
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('auto', 'format');
      u.searchParams.set('q', '80');
      return u.toString();
    } catch {
      return trimmed;
    }
  }

  // Wikipedia commons thumbnail support
  if (trimmed.includes('upload.wikimedia.org/wikipedia/commons/')) {
    const stdWidth = getStandardWikimediaWidth(width);
    
    // Check if it already has /thumb/
    if (trimmed.includes('upload.wikimedia.org/wikipedia/commons/thumb/')) {
      const parts = trimmed.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart && /^\d+px-/.test(lastPart)) {
        parts[parts.length - 1] = lastPart.replace(/^\d+px-/, `${stdWidth}px-`);
        return parts.join('/');
      }
    } else {
      // Convert full-resolution Wikipedia Commons image URL to standard thumbnail URL
      try {
        const parts = trimmed.split('/');
        const filename = parts[parts.length - 1];
        if (filename) {
          const thumbBase = trimmed.replace(
            'upload.wikimedia.org/wikipedia/commons/',
            'upload.wikimedia.org/wikipedia/commons/thumb/'
          );
          return `${thumbBase}/${stdWidth}px-${filename}`;
        }
      } catch {
        return trimmed;
      }
    }
  }

  return trimmed;
}
