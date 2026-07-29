import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SectionHeader from './SectionHeader';

describe('SectionHeader', () => {
  it('group variant renders .place-group-header with name + glyph + actions', () => {
    const { container } = render(
      <SectionHeader
        variant="group"
        glyph={<span className="group-badge-dot" />}
        title="Attractions"
        titleAttr="Attractions"
        actions={<button>Add</button>}
      />
    );
    expect(container.querySelector('.place-group-header')).toBeTruthy();
    const name = container.querySelector('.catalog-group-name');
    expect(name).toHaveTextContent('Attractions');
    expect(name).toHaveAttribute('title', 'Attractions');
    expect(container.querySelector('.group-badge-dot')).toBeTruthy();
    // actions wrapped in the shared cluster
    expect(container.querySelector('.flex-align.flex-align--gap4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('section variant renders .timeline-section-header with title + subtitle', () => {
    const { container } = render(
      <SectionHeader
        variant="section"
        title="Hotels"
        subtitle="2 nights"
        headerClassName="day-schedule-header"
        actions={<button>Add Hotel</button>}
      />
    );
    const header = container.querySelector('.timeline-section-header');
    expect(header).toBeTruthy();
    expect(header).toHaveClass('day-schedule-header');
    expect(container.querySelector('.timeline-section-title')).toHaveTextContent('Hotels');
    expect(container.querySelector('.timeline-section-subtitle')).toHaveTextContent('2 nights');
    expect(container.querySelector('.timeline-section-actions')).toBeTruthy();
  });

  it('omits the actions wrapper when no actions are given', () => {
    const { container } = render(<SectionHeader variant="group" title="Empty" />);
    expect(container.querySelector('.flex-align--gap4')).toBeNull();
  });
});
