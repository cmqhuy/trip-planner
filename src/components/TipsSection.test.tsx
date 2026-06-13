import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TipsSection from './TipsSection';
import type { Trip } from '../types';

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Summer Trip',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  locations: [
    {
      id: 'loc-tokyo',
      city: 'Tokyo',
      country: 'Japan',
      lat: 35.6762,
      lng: 139.6503,
      places: [],
      aiDetails: {
        local_essentials: '### Local Essentials\n- Currency: JPY\n- Convenience store: 7-Eleven'
      },
      aiUpdatedAt: {
        local_essentials: 1773662400000
      }
    }
  ],
  plans: [],
  placeGroups: []
};

describe('TipsSection Component', () => {
  it('renders local essentials markdown when available', () => {
    const handleGenerate = vi.fn();
    const handleSave = vi.fn();
    const handleSetSelectedCatalogLocId = vi.fn();

    render(
      <TipsSection
        trip={mockTrip}
        catalogLocation={mockTrip.locations[0]}
        selectedCatalogLocId="loc-tokyo"
        setSelectedCatalogLocId={handleSetSelectedCatalogLocId}
        generatingLocalEssentials={false}
        onGenerateLocalEssentials={handleGenerate}
        onSaveLocalEssentials={handleSave}
      />
    );

    // Assert currency & store details are rendered
    expect(screen.getByText('Currency: JPY')).toBeInTheDocument();
    expect(screen.getByText('Convenience store: 7-Eleven')).toBeInTheDocument();

    // Assert regenerat button triggers callback
    const regenBtn = screen.getByRole('button', { name: 'Regenerate' });
    expect(regenBtn).toBeInTheDocument();
    fireEvent.click(regenBtn);
    expect(handleGenerate).toHaveBeenCalled();
  });

  it('renders empty state when local essentials are not present', () => {
    const handleGenerate = vi.fn();
    const mockLocationNoTips = {
      ...mockTrip.locations[0],
      aiDetails: {}
    };

    render(
      <TipsSection
        trip={mockTrip}
        catalogLocation={mockLocationNoTips}
        selectedCatalogLocId="loc-tokyo"
        setSelectedCatalogLocId={vi.fn()}
        generatingLocalEssentials={false}
        onGenerateLocalEssentials={handleGenerate}
        onSaveLocalEssentials={vi.fn()}
      />
    );

    expect(screen.getByText('No Local Essentials Reference guide generated yet.')).toBeInTheDocument();

    const generateBtn = screen.getByRole('button', { name: 'Generate Tips' });
    expect(generateBtn).toBeInTheDocument();
    fireEvent.click(generateBtn);
    expect(handleGenerate).toHaveBeenCalled();
  });

  it('renders loader when generating', () => {
    render(
      <TipsSection
        trip={mockTrip}
        catalogLocation={mockTrip.locations[0]}
        selectedCatalogLocId="loc-tokyo"
        setSelectedCatalogLocId={vi.fn()}
        generatingLocalEssentials={true}
        onGenerateLocalEssentials={vi.fn()}
        onSaveLocalEssentials={vi.fn()}
      />
    );

    expect(screen.getByText('Gathering destination reference guide...')).toBeInTheDocument();
  });
});
