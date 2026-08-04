import { useState, useEffect, useRef, memo } from 'react';
import LocationSelect from './LocationSelect';
import { InlineNotes } from './InlineNotes';
import SectionHeader from './SectionHeader';
import GroupActionButton from './GroupActionButton';
import GroupOptionsMenu from './GroupOptionsMenu';
import { PlannerDragCard, PlannerDropZone, PlannerSortableGroup } from './PlannerDnd';
import { catalogGroupDndId, catalogPlaceDndId } from '../utils/plannerDnd';
import {
  MapPin, Plus, Edit2, ChevronUp, ChevronDown,
  Clock, Sparkles, MoreVertical, RefreshCw, ExternalLink, Eye, EyeOff
} from 'lucide-react';
import type { Trip, Plan, Location, Place, PlaceGroup } from '../types';
import { DEFAULT_PLACE_GROUPS, buildMapsLink } from '../utils/api';
import { getOptimizedImageUrl } from '../utils/image';

interface CatalogSectionProps {
  trip: Trip;
  catalogLocation: Location | undefined;
  selectedCatalogLocId: string;
  setSelectedCatalogLocId: (id: string) => void;
  hideAllocatedPlaces: boolean;
  setHideAllocatedPlaces: (hide: boolean) => void;
  activePlaceId: string | undefined;
  setActivePlaceId: (id: string | undefined) => void;
  placeAllocatedDaysMap: Map<string, string[]>;
  getCachedFormattedDisplayDate: (dateStr: string) => string;
  activeDayStr: string;
  activePlan: Plan;
  onEditLocation: () => void;
  onAddLocation: () => void;
  onAddPlaceToDay: (place: Place) => void;
  onOpenEditPlace: (place: Place) => void;
  draggedPlaceId: string | null;
  dragOverGroupId: string | null;
  dragOverPlaceId: string | null;
  dragOverPlacePosition: 'top' | 'bottom';
  handleMoveCatalogPlace: (placeId: string, direction: 'up' | 'down') => void;
  handleMoveGroupOrder: (index: number, direction: 'up' | 'down') => void;
  hiddenMapGroupIds: string[];
  onToggleGroupMapVisibility: (groupId: string) => void;
  startEditingGroup: (group: PlaceGroup) => void;
  setShowGroupModal: (show: boolean) => void;
  setAiGeneratePlaces: (places: Place[]) => void;
  setAiGenerateCity: (city: string) => void;
  setAiGenerateCountry: (country: string) => void;
  setShowAiGenerateModal: (show: boolean) => void;
  setEditingPlace: (place: Place | null) => void;
  setShowCustomPlaceModal: (show: boolean) => void;
  setAutoScheduleOnActiveDay: (auto: boolean) => void;
  savePlaceNotes: (placeId: string, notes: string) => void;
  aiSuggestedPlaces: Place[];
  isLoadingAiSuggestions: boolean;
  aiSuggestionsLocId: string | null;
  aiSuggestionsError: string | null;
  onAiSuggestPlaces: () => void;
}

function CatalogSection({
  trip,
  catalogLocation,
  selectedCatalogLocId,
  setSelectedCatalogLocId,
  hideAllocatedPlaces,
  setHideAllocatedPlaces,
  activePlaceId,
  setActivePlaceId,
  placeAllocatedDaysMap,
  getCachedFormattedDisplayDate,
  activeDayStr,
  activePlan,
  onEditLocation,
  onAddLocation,
  onAddPlaceToDay,
  onOpenEditPlace,
  draggedPlaceId,
  dragOverGroupId,
  dragOverPlaceId,
  dragOverPlacePosition,
  handleMoveCatalogPlace,
  handleMoveGroupOrder,
  hiddenMapGroupIds,
  onToggleGroupMapVisibility,
  startEditingGroup,
  setShowGroupModal,
  setAiGeneratePlaces,
  setAiGenerateCity,
  setAiGenerateCountry,
  setShowAiGenerateModal,
  setEditingPlace,
  setShowCustomPlaceModal,
  setAutoScheduleOnActiveDay,
  savePlaceNotes,
  aiSuggestedPlaces = [],
  isLoadingAiSuggestions = false,
  aiSuggestionsLocId = null,
  aiSuggestionsError = null,
  onAiSuggestPlaces
}: CatalogSectionProps) {
  const [activePlaceDropdownId, setActivePlaceDropdownId] = useState<string | null>(null);

  const aiSuggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((isLoadingAiSuggestions || aiSuggestedPlaces.length > 0) && aiSuggestionsLocId === selectedCatalogLocId) {
      const timer = setTimeout(() => {
        aiSuggestionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLoadingAiSuggestions, aiSuggestedPlaces.length, aiSuggestionsLocId, selectedCatalogLocId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.catalog-place-dropdown-container-mobile')) {
        setActivePlaceDropdownId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      {/* Location picker — fixed above the scroll area, does not scroll */}
      <div className="left-panel-header panel-header--catalog">
        <div className="catalog-header-row">
          <LocationSelect
            value={selectedCatalogLocId}
            onChange={setSelectedCatalogLocId}
            locations={trip.locations}
            style={{ flex: 1, minWidth: 0 }}
          />

          {catalogLocation && trip.canEdit !== false && (
            <button
              className="mini-icon-btn catalog-ai-suggest-btn"
              onClick={onAiSuggestPlaces}
              disabled={isLoadingAiSuggestions}
              data-tooltip={`AI Travel Guide for ${catalogLocation.city}`}
              data-tooltip-position="bottom"
            >
              {isLoadingAiSuggestions ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
            </button>
          )}
          {catalogLocation && trip.canEdit !== false && (
            <button
              className="mini-icon-btn catalog-header-icon-btn"
              onClick={onEditLocation}
              data-tooltip="Edit Location Settings"
              data-tooltip-position="bottom"
            >
              <Edit2 size={12} />
            </button>
          )}
          {trip.canEdit !== false && (
            <button
              className="btn-primary flex-align add-location-btn catalog-header-icon-btn"
              onClick={onAddLocation}
              data-tooltip="Add Location"
              data-tooltip-position="bottom"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Catalog Group Management — pinned above the scroll area, never scrolls */}
      {catalogLocation && (
        <div className="subsection-header catalog-groups-header catalog-groups-header--pinned">
          <h4 className="subsection-title catalog-groups-label">Groups</h4>
          <div className="subsection-actions catalog-groups-right">
            <label className="flex-align catalog-hide-allocated-label">
              <input
                type="checkbox"
                checked={hideAllocatedPlaces}
                onChange={(e) => setHideAllocatedPlaces(e.target.checked)}
                className="catalog-checkbox"
              />
              Hide Allocated
            </label>
            {trip.canEdit !== false && (
              <button
                className="mini-icon-btn catalog-add-group-btn"
                onClick={() => setShowGroupModal(true)}
                data-tooltip="Add Group"
                data-tooltip-position="bottom"
              >
                <Plus size={14} /> Add Group
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scrollable catalog content */}
      <div className="accordion-content">
      {catalogLocation ? (
        <div className="catalog-content">
          {/* List by Groups */}
          {[
            ...(trip.placeGroups || DEFAULT_PLACE_GROUPS).map((group, groupIdx, allGroups) => ({
              ...group,
              groupIdx,
              isReorderable: true,
              isFirst: groupIdx === 0,
              isLast: groupIdx === allGroups.length - 1
            })),
            { id: 'new', name: 'New / Unassigned', color: '#6b7280', icon: 'map-pin', isReorderable: false, groupIdx: -1, isFirst: false, isLast: false }
          ].map(group => {
            const placesInGroup = catalogLocation.places.filter(p => {
              if (group.id === 'new') {
                return !p.placeGroupId || p.placeGroupId === 'new';
              }
              return p.placeGroupId === group.id;
            });
            const filteredPlaces = placesInGroup.filter(p => {
              if (!hideAllocatedPlaces) return true;
              return !Object.values(activePlan.days).some(day => day.placeIds.includes(p.id));
            });
            if (placesInGroup.length === 0 && group.id === 'new') return null;

            // A place moving within its own group is handled by the sorting
            // strategy (cards slide aside); one arriving from another group is not
            // part of this list, so it gets the indicator line.
            const isCrossGroupDrag = !!draggedPlaceId && !placesInGroup.some(p => p.id === draggedPlaceId);

            return (
              <PlannerDropZone
                key={group.id}
                id={catalogGroupDndId(group.id)}
                data={{ target: 'catalog-group', groupId: group.id }}
              >
                {({ setNodeRef: setGroupDropRef }) => (
              <div
                ref={setGroupDropRef}
                className={`place-group-section${dragOverGroupId === group.id && draggedPlaceId ? ' place-group-section--drop-target' : ''}`}
              >
                <SectionHeader
                  variant="group"
                  glyph={<span className="group-badge-dot" style={{ backgroundColor: group.color }} />}
                  title={group.name}
                  titleAttr={group.name}
                  actions={<>
                    {trip.canEdit !== false && (
                      <>
                        <GroupActionButton
                          icon={Sparkles}
                          label={`AI Travel Guide for ${group.name}`}
                          className="catalog-group-ai-btn"
                          onClick={() => {
                            setAiGeneratePlaces(placesInGroup);
                            setAiGenerateCity(catalogLocation?.city || '');
                            setAiGenerateCountry(catalogLocation?.country || '');
                            setShowAiGenerateModal(true);
                          }}
                        />
                        <GroupActionButton
                          icon={Plus}
                          label={`Add Place to ${group.name}`}
                          onClick={() => {
                            setEditingPlace({
                              id: `new-temp-${Date.now()}`,
                              title: '',
                              description: '',
                              openingHours: '',
                              lat: catalogLocation?.lat || 0,
                              lng: catalogLocation?.lng || 0,
                              placeGroupId: group.id,
                              notes: '',
                              photoUrl: '',
                              mapsLink: ''
                            });
                            setAutoScheduleOnActiveDay(false);
                            setShowCustomPlaceModal(true);
                          }}
                        />
                      </>
                    )}
                    {group.isReorderable && trip.canEdit !== false && (() => {
                      const totalReorderable = (trip.placeGroups || DEFAULT_PLACE_GROUPS).length;
                      const showAbove = group.groupIdx >= Math.max(1, totalReorderable - 2);
                      return (
                        <GroupOptionsMenu
                          showAbove={showAbove}
                          disableUp={group.isFirst}
                          disableDown={group.isLast}
                          onMoveUp={() => handleMoveGroupOrder(group.groupIdx!, 'up')}
                          onMoveDown={() => handleMoveGroupOrder(group.groupIdx!, 'down')}
                          onEdit={() => startEditingGroup(group as PlaceGroup)}
                          extraItems={(close) => (
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={(e) => { e.stopPropagation(); onToggleGroupMapVisibility(group.id); close(); }}
                            >
                              {hiddenMapGroupIds.includes(group.id)
                                ? <><Eye size={12} /> Show on map</>
                                : <><EyeOff size={12} /> Hide on map</>}
                            </button>
                          )}
                        />
                      );
                    })()}
                    <span className="badge badge--count">
                      {filteredPlaces.length}
                    </span>
                  </>}
                />

                <PlannerSortableGroup items={filteredPlaces.map(p => catalogPlaceDndId(p.id))}>
                <div className="catalog-places-list catalog-places-list--mh">
                  {filteredPlaces.map((place, placeIndexInGroup) => (
                    <PlannerDragCard
                      key={place.id}
                      id={catalogPlaceDndId(place.id)}
                      dragData={{ source: 'catalog', placeId: place.id, label: place.title }}
                      dropData={{ target: 'catalog-place', placeId: place.id, groupId: group.id }}
                      disabled={trip.canEdit === false}
                    >
                      {({ setNodeRef: setCardRef, handleProps, style, isDragging }) => {
                      // Sorting only shifts cards within their own group, so a place
                      // arriving from a different group gets the indicator line instead.
                      const isDropTarget = isCrossGroupDrag && dragOverPlaceId === place.id;
                      return (
                    <div className="catalog-place-wrapper">
                      {isDropTarget && (
                        <div className={`drag-indicator-line drag-indicator-line--${dragOverPlacePosition}`} />
                      )}
                      <div
                        ref={setCardRef}
                        {...handleProps}
                        style={style}
                        className={`catalog-place-card ${isDragging ? 'dnd-drag-origin' : ''} ${activePlaceId === place.id ? 'catalog-place-card--active' : ''} ${activePlaceDropdownId === place.id ? 'dropdown-active' : ''} ${activePlaceId === place.id ? 'details-expanded' : ''}`}
                        onClick={() => setActivePlaceId(activePlaceId === place.id ? undefined : place.id)}
                      >
                        <div className="place-card-header">
                          {place.photoUrl ? (
                            <div className="place-card-thumb-container">
                              <img
                                src={getOptimizedImageUrl(place.photoUrl, 120)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                          ) : (
                            <div className="place-card-thumb-container">
                              <MapPin size={16} className="text-muted" />
                            </div>
                          )}
                          <div className="place-card-info">
                            <div className="catalog-place-info-header">
                              <h4 className="catalog-place-title catalog-place-title--no-margin">{place.title}</h4>
                              {(() => {
                                const allocatedDays = placeAllocatedDaysMap.get(place.id) || [];
                                if (allocatedDays.length === 0) return null;
                                return (
                                  <div className="catalog-allocated-days">
                                    {allocatedDays.map(dateStr => {
                                      const isActiveDay = dateStr === activeDayStr;
                                      const formatted = getCachedFormattedDisplayDate(dateStr);
                                      return (
                                        <span
                                          key={dateStr}
                                          style={{
                                            fontSize: '9px',
                                            fontWeight: 600,
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            background: isActiveDay ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.03)',
                                            color: isActiveDay ? '#ffffff' : 'var(--text-muted)',
                                            border: isActiveDay ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                                            whiteSpace: 'nowrap'
                                          }}
                                          title={isActiveDay ? 'Scheduled for today' : `Scheduled for ${formatted}`}
                                        >
                                          {formatted.split(',')[1]?.trim() || dateStr}
                                        </span>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                            {place.openingHours && (
                              <div className="place-card-hours">
                                <Clock size={10} /> <span>{place.openingHours}</span>
                              </div>
                            )}
                          </div>
                          {trip.canEdit !== false && (
                            <div
                              className="place-card-move-buttons catalog-place-actions-desktop"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                className="mini-icon-btn"
                                disabled={placeIndexInGroup === 0}
                                onClick={() => handleMoveCatalogPlace(place.id, 'up')}
                                style={{ opacity: placeIndexInGroup === 0 ? 0.3 : 1 }}
                                data-tooltip="Move Up"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                className="mini-icon-btn"
                                disabled={placeIndexInGroup === filteredPlaces.length - 1}
                                onClick={() => handleMoveCatalogPlace(place.id, 'down')}
                                style={{ opacity: placeIndexInGroup === filteredPlaces.length - 1 ? 0.3 : 1 }}
                                data-tooltip="Move Down"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        {trip.canEdit !== false && (
                          <div
                            className="catalog-place-dropdown-container-mobile catalog-mobile-dropdown"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              className="mini-icon-btn catalog-mobile-trigger-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePlaceDropdownId(activePlaceDropdownId === place.id ? null : place.id);
                              }}
                              data-tooltip="Place Options"
                            >
                              <MoreVertical size={14} />
                            </button>
                            {activePlaceDropdownId === place.id && (
                              <div className="dropdown-menu">
                                <button
                                  className="dropdown-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddPlaceToDay(place);
                                    setActivePlaceDropdownId(null);
                                  }}
                                >
                                  <Plus size={12} /> Add to Day
                                </button>
                                <button
                                  className="dropdown-item"
                                  disabled={placeIndexInGroup === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveCatalogPlace(place.id, 'up');
                                    setActivePlaceDropdownId(null);
                                  }}
                                  style={{ opacity: placeIndexInGroup === 0 ? 0.3 : 1 }}
                                >
                                  <ChevronUp size={12} /> Move Up
                                </button>
                                <button
                                  className="dropdown-item"
                                  disabled={placeIndexInGroup === filteredPlaces.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveCatalogPlace(place.id, 'down');
                                    setActivePlaceDropdownId(null);
                                  }}
                                  style={{ opacity: placeIndexInGroup === filteredPlaces.length - 1 ? 0.3 : 1 }}
                                >
                                  <ChevronDown size={12} /> Move Down
                                </button>
                                <button
                                  className="dropdown-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenEditPlace(place);
                                    setActivePlaceDropdownId(null);
                                  }}
                                >
                                  <Edit2 size={12} /> Edit Details
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expand Details if selected */}
                        <div className={`card-expandable-wrapper${activePlaceId === place.id ? ' is-expanded' : ''}`}>
                          <div>
                          <div className="catalog-place-expanded" onClick={e => e.stopPropagation()}>
                            {place.description && <p className="catalog-place-desc">{place.description}</p>}

                            {/* Notes Field (Shared at Trip level) */}
                            <InlineNotes
                              value={place.notes}
                              canEdit={trip.canEdit !== false}
                              onSave={(text) => savePlaceNotes(place.id, text)}
                              layout="card"
                            />

                            {/* Actions */}
                            <div className="catalog-place-actions-row">
                              <a
                                href={place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, catalogLocation?.city)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary flex-align catalog-place-link-btn"
                              >
                                <MapPin size={10} /> Map
                              </a>
                              {trip.canEdit !== false && (
                                <div className="catalog-place-actions-desktop catalog-place-actions-desktop--gap">
                                  <button
                                    className="btn-secondary flex-align catalog-place-link-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenEditPlace(place);
                                    }}
                                    data-tooltip="Edit Place Details"
                                  >
                                    <Edit2 size={12} /> Edit
                                  </button>
                                  <button
                                    className="btn-primary catalog-place-link-btn"
                                    onClick={() => {
                                      onAddPlaceToDay(place);
                                    }}
                                  >
                                    + Add to Day
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          </div>
                        </div>
                      </div>
                    </div>
                      );
                      }}
                    </PlannerDragCard>
                  ))}
                </div>
                </PlannerSortableGroup>
              </div>
                )}
              </PlannerDropZone>
            );
          })}
          {/* AI Suggestions Group */}
          {aiSuggestionsError && aiSuggestionsLocId === selectedCatalogLocId && (
            <div className="catalog-ai-error-panel">
              {aiSuggestionsError}
            </div>
          )}
          {(isLoadingAiSuggestions || aiSuggestedPlaces.length > 0) && aiSuggestionsLocId === selectedCatalogLocId && (
            <div ref={aiSuggestionsRef} className="place-group-section catalog-ai-suggestions-group">
              <div className="place-group-header">
                <span className="place-group-title">
                  <Sparkles size={12} className="text-ai-purple flex-shrink-0" />
                  <span className="catalog-ai-suggestions-label">AI Suggestions</span>
                </span>
                <div className="flex-align flex-align--gap4">
                  <button
                    className="mini-icon-btn catalog-group-action-btn catalog-ai-refresh-btn"
                    onClick={onAiSuggestPlaces}
                    disabled={isLoadingAiSuggestions}
                    data-tooltip="Refresh AI Suggestions"
                  >
                    <RefreshCw size={13} className={isLoadingAiSuggestions ? 'spin' : ''} />
                  </button>
                  <span className="badge badge--ai-count">
                    {aiSuggestedPlaces.length}
                  </span>
                </div>
              </div>

              {isLoadingAiSuggestions && aiSuggestedPlaces.length === 0 && (
                <div className="catalog-ai-loading-row">
                  <RefreshCw size={13} className="spin flex-shrink-0" />
                  Asking Gemini for place suggestions...
                </div>
              )}
              <div className="catalog-places-list">
                {aiSuggestedPlaces.map(place => (
                  <div key={place.id} className="catalog-place-wrapper">
                    <div
                      className={`catalog-place-card catalog-ai-card ${activePlaceId === place.id ? 'details-expanded' : ''}`}
                      onClick={() => setActivePlaceId(activePlaceId === place.id ? undefined : place.id)}
                      style={{
                        borderColor: activePlaceId === place.id ? '#a78bfa' : 'rgba(167,139,250,0.15)',
                      }}
                    >
                      <div className="place-card-header">
                        {place.photoUrl ? (
                          <div className="place-card-thumb-container">
                            <img src={place.photoUrl} alt="" loading="lazy" decoding="async" />
                          </div>
                        ) : (
                          <div className="place-card-thumb-container">
                            <Sparkles size={14} className="text-ai-purple" />
                          </div>
                        )}
                        <div className="place-card-info">
                          <h4 className="catalog-place-title catalog-place-title--no-margin">{place.title}</h4>
                          {place.openingHours && (
                            <div className="place-card-hours">
                              <Clock size={10} /> <span>{place.openingHours}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      <div className={`card-expandable-wrapper${activePlaceId === place.id ? ' is-expanded' : ''}`}>
                        <div>
                        <div className="catalog-ai-expanded" onClick={e => e.stopPropagation()}>
                          {place.description && (
                            <p className="catalog-place-desc">{place.description}</p>
                          )}
                          {place.notes && (
                            <div className="catalog-ai-notes-box">
                              {place.notes}
                            </div>
                          )}
                          <div className="catalog-place-actions-row">
                            <a
                              href={place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, catalogLocation?.city)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary flex-align catalog-place-link-btn"
                            >
                              Map <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="catalog-empty-state">
          Add locations above to start building your Catalog.
        </div>
      )}
      </div>
    </>
  );
}

export default memo(CatalogSection);
