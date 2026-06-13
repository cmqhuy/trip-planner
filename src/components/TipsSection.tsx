import { Sparkles, RefreshCw } from 'lucide-react';
import type { Trip, Location } from '../types';
import { getLocIcon, getFormattedLocationName } from '../utils/api';
import FunGeneratingLoader from './FunGeneratingLoader';
import AiMarkdownSection from './AiMarkdownSection';

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
    <div className="accordion-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 }}>
      {/* Location Select (Synced with Catalog, No Add/Edit buttons) */}
      <div style={{ padding: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
        <select
          value={selectedCatalogLocId}
          onChange={(e) => setSelectedCatalogLocId(e.target.value)}
          style={{ width: '100%', padding: '6px 28px 6px 10px', fontSize: '12px', background: 'var(--bg-dark)', minWidth: 0, border: '1px solid var(--border-glass)', borderRadius: '6px' }}
        >
          {trip.locations.length === 0 && <option value="">No Locations Added</option>}
          {trip.locations.map(loc => (
            <option key={loc.id} value={loc.id}>{getLocIcon(loc)} {getFormattedLocationName(loc, trip.locations)}</option>
          ))}
        </select>
      </div>

      {/* Local Essentials Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', flex: 1, minHeight: 0 }}>
        <div className="flex-between">
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'none' }}>
            Quick reference for convenience stores, currencies, local apps, dress codes, etc.
          </span>
          {catalogLocation && trip.canEdit !== false && (
            <button 
              className="mini-icon-btn flex-align"
              style={{ fontSize: '10px', padding: '2px 8px', gap: '4px', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.12)', flexShrink: 0 }}
              onClick={onGenerateLocalEssentials}
              disabled={generatingLocalEssentials}
            >
              {generatingLocalEssentials ? <RefreshCw size={10} className="spin" /> : <Sparkles size={10} />}
              {catalogLocation.aiDetails?.local_essentials ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>

        {generatingLocalEssentials ? (
          <FunGeneratingLoader message="Gathering destination reference guide..." />
        ) : catalogLocation && catalogLocation.aiDetails?.local_essentials ? (
          <AiMarkdownSection 
            content={catalogLocation.aiDetails.local_essentials} 
            updatedAt={catalogLocation.aiUpdatedAt?.local_essentials} 
            onSave={onSaveLocalEssentials}
            canEdit={trip.canEdit !== false}
            style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}
          />
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', marginBottom: '8px' }}>
              No Local Essentials Reference guide generated yet.
            </span>
            {catalogLocation && trip.canEdit !== false && (
              <button 
                className="btn-secondary flex-align"
                style={{ margin: '0 auto', fontSize: '11px', padding: '4px 10px', gap: '4px' }}
                onClick={onGenerateLocalEssentials}
              >
                <Sparkles size={11} /> Generate Tips
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
