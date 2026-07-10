import { describe, it, expect } from 'vitest';
import { _testHelpers } from './ai';

const { fixMarkdownHeaders, getDayOfWeek } = _testHelpers;

describe('ai helper functions', () => {
  describe('getDayOfWeek', () => {
    it('returns the day of the week for valid date string', () => {
      expect(getDayOfWeek('2026-07-10')).toBe('Friday');
      expect(getDayOfWeek('2026-07-11')).toBe('Saturday');
    });

    it('returns empty string for invalid date string', () => {
      expect(getDayOfWeek('')).toBe('');
      expect(getDayOfWeek('invalid-date')).toBe('');
    });
  });

  describe('fixMarkdownHeaders', () => {
    it('does nothing on empty string', () => {
      expect(fixMarkdownHeaders('')).toBe('');
    });

    it('ensures newline before headers when missing', () => {
      const input = 'Some paragraph text## Daily Route Sequence & Summary\nBegin your day...';
      const expected = 'Some paragraph text\n## Daily Route Sequence & Summary\nBegin your day...';
      expect(fixMarkdownHeaders(input)).toBe(expected);
    });

    it('ensures newline after standard headers when missing (no space)', () => {
      const input = '## Daily Route Sequence & SummaryBegin your day at Louvre...';
      const expected = '## Daily Route Sequence & Summary\nBegin your day at Louvre...';
      expect(fixMarkdownHeaders(input)).toBe(expected);
    });

    it('ensures newline after standard headers when missing (with space)', () => {
      const input = '## Timing & Optimization Suggestions The Louvre is closed on Tuesdays...';
      const expected = '## Timing & Optimization Suggestions\nThe Louvre is closed on Tuesdays...';
      expect(fixMarkdownHeaders(input)).toBe(expected);
    });

    it('handles warning headers with closed status', () => {
      const input = '## WARNING: Louvre Museum ClosedBegin your day at Orsay instead...';
      const expected = '## WARNING: Louvre Museum Closed\nBegin your day at Orsay instead...';
      expect(fixMarkdownHeaders(input)).toBe(expected);
    });

    it('leaves properly formatted headers untouched', () => {
      const input = '## Daily Route Sequence & Summary\nBegin your day...\n\n## Logistics & Alerts\nBe careful...';
      expect(fixMarkdownHeaders(input)).toBe(input);
    });
  });
});
