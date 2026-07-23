import { Sparkles, RefreshCw } from 'lucide-react';
import type { Trip, Location } from '../types';
import FunGeneratingLoader from './FunGeneratingLoader';
import AiMarkdownSection from './AiMarkdownSection';
import LocationSelect from './LocationSelect';

interface TipsSectionProps {
  trip: Trip;
  catalogLocation: Location | undefined;
  selectedCatalogLocId: string;
  setSelectedCatalogLocId: (id: string) => void;
  generatingLocalEssentials: boolean;
  onGenerateLocalEssentials: () => void;
  onSaveLocalEssentials: (content: string) => void;
}

export default function TipsSection({
  trip,
  catalogLocation,
  selectedCatalogLocId,
  setSelectedCatalogLocId,
  generatingLocalEssentials,
  onGenerateLocalEssentials,
  onSaveLocalEssentials
}: TipsSectionProps) {
  return (
    <>
      {/* Location Select — fixed above the scroll area, does not scroll */}
      <div className="left-panel-header tips-location-header">
        <LocationSelect
          value={selectedCatalogLocId}
          onChange={setSelectedCatalogLocId}
          locations={trip.locations}
        />
      </div>

      <div className="accordion-content">
      {/* Local Essentials Content */}
      <div className="left-panel-subsection">
        <div className="subsection-header">
          <h4 className="subsection-title">Local Essentials</h4>
          <div className="subsection-actions">
            {catalogLocation && trip.canEdit !== false && (
              <button
                className="panel-ai-action-btn tips-regen-btn"
                onClick={onGenerateLocalEssentials}
                disabled={generatingLocalEssentials}
              >
                {generatingLocalEssentials ? <RefreshCw size={10} className="spin" /> : <Sparkles size={10} />}
                {catalogLocation.aiDetails?.local_essentials ? 'Regenerate' : 'Generate'}
              </button>
            )}
          </div>
        </div>

        <span className="subsection-subtitle subsection-subtitle--block">
          Quick reference for safety tips, convenience stores, currencies, local apps, etc.
        </span>

        <div className="subsection-content">
          {generatingLocalEssentials ? (
            <FunGeneratingLoader message="Gathering destination reference guide..." />
          ) : catalogLocation && catalogLocation.aiDetails?.local_essentials ? (
            <AiMarkdownSection
              content={catalogLocation.aiDetails.local_essentials}
              updatedAt={catalogLocation.aiUpdatedAt?.local_essentials}
              onSave={onSaveLocalEssentials}
              canEdit={trip.canEdit !== false}
            />
          ) : (
            <div className="tips-empty-state">
              <span className="subsection-subtitle tips-empty-subtitle">
                No guide generated yet.
              </span>
              {catalogLocation && trip.canEdit !== false && (
                <button
                  className="btn-secondary flex-align tips-generate-btn"
                  onClick={onGenerateLocalEssentials}
                >
                  <Sparkles size={11} /> Generate Tips
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
