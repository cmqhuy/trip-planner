import { describe, test, expect } from 'vitest';
import { getOptimizedImageUrl } from './image';

describe('image optimization tests', () => {
  test('handles undefined or empty URL', () => {
    expect(getOptimizedImageUrl(undefined, 80)).toBe('');
    expect(getOptimizedImageUrl('', 80)).toBe('');
    expect(getOptimizedImageUrl('   ', 80)).toBe('');
  });

  test('optimizes Unsplash URLs', () => {
    const unsplashUrl = 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=600&q=80';
    const optimized = getOptimizedImageUrl(unsplashUrl, 120);
    expect(optimized).toContain('w=120');
    expect(optimized).toContain('fit=crop');
    expect(optimized).toContain('auto=format');
  });

  test('normalizes Wikipedia Commons thumbnail URLs to standard widths', () => {
    // 80 should map to standard 120
    const wikiThumbUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Colosseum_in_Rome%2C_Italy_-_April_2007.jpg/1000px-Colosseum_in_Rome%2C_Italy_-_April_2007.jpg';
    const optimized80 = getOptimizedImageUrl(wikiThumbUrl, 80);
    expect(optimized80).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Colosseum_in_Rome%2C_Italy_-_April_2007.jpg/120px-Colosseum_in_Rome%2C_Italy_-_April_2007.jpg');

    // 240 should map to standard 250
    const optimized240 = getOptimizedImageUrl(wikiThumbUrl, 240);
    expect(optimized240).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Colosseum_in_Rome%2C_Italy_-_April_2007.jpg/250px-Colosseum_in_Rome%2C_Italy_-_April_2007.jpg');
  });

  test('converts full-resolution Wikipedia Commons URLs to standard thumbnail URLs', () => {
    const wikiFullUrl = 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Colosseum_in_Rome%2C_Italy_-_April_2007.jpg';
    const optimized = getOptimizedImageUrl(wikiFullUrl, 80);
    expect(optimized).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Colosseum_in_Rome%2C_Italy_-_April_2007.jpg/120px-Colosseum_in_Rome%2C_Italy_-_April_2007.jpg');
  });

  test('leaves other URLs unmodified', () => {
    const randomUrl = 'https://example.com/image.jpg';
    expect(getOptimizedImageUrl(randomUrl, 80)).toBe(randomUrl);
  });
});
