import { useState, useEffect, useRef } from 'react';
import LocationSelect from './LocationSelect';
import {
  MapPin, Plus, Edit2, ExternalLink, ChevronUp, ChevronDown,
  Clock, FileText, Sparkles, MoreVertical, Check, RefreshCw
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
  setDraggedPlaceId: (id: string | null) => void;
  setDragOverGroupId: (id: string | null) => void;
  setDragOverPlaceId: (id: string | null) => void;
  setDragOverPlacePosition: (pos: 'top' | 'bottom') => void;
  handlePlaceDragStart: (id: string) => void;
  handlePlaceDropOnGroup: (groupId: string) => void;
  handlePlaceDropOnPlace: (targetPlaceId: string, groupId: string, position: 'top' | 'bottom') => void;
  handleMoveCatalogPlace: (placeId: string, direction: 'up' | 'down') => void;
  handleMoveGroupOrder: (index: number, direction: 'up' | 'down') => void;
  startEditingGroup: (group: PlaceGroup) => void;
  setShowGroupModal: (show: boolean) => void;
  setAiGeneratePlaces: (places: Place[]) => void;
  setAiGenerateCity: (city: string) => void;
  setAiGenerateCountry: (country: string) => void;
  setShowAiGenerateModal: (show: boolean) => void;
  setEditingPlace: (place: Place | null) => void;
  setShowCustomPlaceModal: (show: boolean) => void;
  setAutoScheduleOnActiveDay: (auto: boolean) => void;
  editingPlaceNotesId: string | null;
  setEditingPlaceNotesId: (id: string | null) => void;
  tempNotes: string;
  setTempNotes: (notes: string) => void;
  startEditingNotes: (place: Place) => void;
  savePlaceNotes: (placeId: string) => void;
  activeGroupDropdownId: string | null;
  setActiveGroupDropdownId: (id: string | null) => void;
  aiSuggestedPlaces: Place[];
  isLoadingAiSuggestions: boolean;
  aiSuggestionsLocId: string | null;
  aiSuggestionsError: string | null;
  onAiSuggestPlaces: () => void;
}

export default function CatalogSection({
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
  setDraggedPlaceId,
  setDragOverGroupId,
  setDragOverPlaceId,
  setDragOverPlacePosition,
  handlePlaceDragStart,
  handlePlaceDropOnGroup,
  handlePlaceDropOnPlace,
  handleMoveCatalogPlace,
  handleMoveGroupOrder,
  startEditingGroup,
  setShowGroupModal,
  setAiGeneratePlaces,
  setAiGenerateCity,
  setAiGenerateCountry,
  setShowAiGenerateModal,
  setEditingPlace,
  setShowCustomPlaceModal,
  setAutoScheduleOnActiveDay,
  editingPlaceNotesId,
  setEditingPlaceNotesId,
  tempNotes,
  setTempNotes,
  startEditingNotes,
  savePlaceNotes,
  activeGroupDropdownId,
  setActiveGroupDropdownId,
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
    <div className="accordion-content">
      {/* Back to dashboard and select location inside catalog */}
      <div className="panel-header" style={{ padding: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <LocationSelect
            value={selectedCatalogLocId}
            onChange={setSelectedCatalogLocId}
            locations={trip.locations}
            style={{ flex: 1, minWidth: 0 }}
          />
          
          {catalogLocation && trip.canEdit !== false && (
            <button
              className="mini-icon-btn"
              onClick={onAiSuggestPlaces}
              disabled={isLoadingAiSuggestions}
              data-tooltip={`AI Travel Guide for ${catalogLocation.city}`}
              data-tooltip-position="bottom"
              style={{ padding: '6px', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#a78bfa' }}
            >
              {isLoadingAiSuggestions ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
            </button>
          )}
          {catalogLocation && trip.canEdit !== false && (
            <button
              className="mini-icon-btn"
              onClick={onEditLocation}
              data-tooltip="Edit Location Settings"
              data-tooltip-position="bottom"
              style={{ padding: '6px', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Edit2 size={12} />
            </button>
          )}
          {trip.canEdit !== false && (
            <button
              className="btn-primary flex-align add-location-btn"
              style={{ padding: '6px', fontSize: '11px', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onClick={onAddLocation}
              data-tooltip="Add Location"
              data-tooltip-position="bottom"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      </div>

      {catalogLocation ? (
        <div className="catalog-content" style={{ padding: 0 }}>
          {/* Catalog Group Management */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Groups</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label className="flex-align" style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', gap: '4px' }}>
                <input
                  type="checkbox"
                  checked={hideAllocatedPlaces}
                  onChange={(e) => setHideAllocatedPlaces(e.target.checked)}
                  style={{ margin: 0, width: '13px', height: '13px', accentColor: 'var(--accent-primary)', minHeight: 'auto', cursor: 'pointer' }}
                />
                Hide Allocated
              </label>
              {trip.canEdit !== false && (
                <button 
                  className="mini-icon-btn" 
                  onClick={() => setShowGroupModal(true)} 
                  data-tooltip="Add Group"
                  data-tooltip-position="bottom"
                  style={{ color: 'var(--accent-secondary)', padding: '2px' }}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          </div>

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

            return (
              <div 
                key={group.id} 
                className="place-group-section"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedPlaceId && dragOverGroupId !== group.id) {
                    setDragOverGroupId(group.id);
                  }
                }}
                onDragLeave={() => setDragOverGroupId(null)}
                onDrop={() => {
                  handlePlaceDropOnGroup(group.id);
                  setDragOverGroupId(null);
                }}
                style={{
                  border: (dragOverGroupId === group.id && draggedPlaceId) ? '2px dashed var(--accent-primary)' : '2px dashed transparent',
                  borderRadius: '8px',
                  padding: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div className="place-group-header">
                  <span className="place-group-title">
                    <span className="group-badge-dot" style={{ backgroundColor: group.color }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={group.name}>
                      {group.name}
                    </span>
                  </span>
                  <div className="flex-align" style={{ gap: '4px' }}>
                    {trip.canEdit !== false && (
                      <>
                        <button 
                          className="mini-icon-btn" 
                          onClick={() => {
                            setAiGeneratePlaces(placesInGroup);
                            setAiGenerateCity(catalogLocation?.city || '');
                            setAiGenerateCountry(catalogLocation?.country || '');
                            setShowAiGenerateModal(true);
                          }} 
                          data-tooltip={`AI Travel Guide for ${group.name}`} 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', padding: 0, color: '#a5b4fc' }}
                        >
                          <Sparkles size={14} />
                        </button>
                        
                        <button 
                          className="mini-icon-btn" 
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
                          data-tooltip={`Add Place to ${group.name}`} 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', padding: 0 }}
                        >
                          <Plus size={14} />
                        </button>
                      </>
                    )}
                    {group.isReorderable && trip.canEdit !== false && (
                      <div className="group-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                        <button 
                          className="mini-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveGroupDropdownId(activeGroupDropdownId === group.id ? null : group.id);
                          }}
                          data-tooltip="Group Options"
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            width: '24px', 
                            height: '24px', 
                            padding: 0,
                            cursor: 'pointer'
                          }}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {activeGroupDropdownId === group.id && (
                          <div className="dropdown-menu" style={{ right: 0, left: 'auto' }}>
                            <button 
                              className="dropdown-item"
                              disabled={group.isFirst}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveGroupOrder(group.groupIdx!, 'up');
                                setActiveGroupDropdownId(null);
                              }}
                            >
                              <ChevronUp size={12} /> Move Up
                            </button>
                            <button 
                              className="dropdown-item"
                              disabled={group.isLast}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveGroupOrder(group.groupIdx!, 'down');
                                setActiveGroupDropdownId(null);
                              }}
                            >
                              <ChevronDown size={12} /> Move Down
                            </button>
                            <button 
                              className="dropdown-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingGroup(group as PlaceGroup);
                                setActiveGroupDropdownId(null);
                              }}
                            >
                              <Edit2 size={12} /> Edit Group
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                      {filteredPlaces.length}
                    </span>
                  </div>
                </div>

                <div 
                  className="catalog-places-list" 
                  onDragLeave={() => setDragOverPlaceId(null)}
                  style={{ minHeight: '30px' }}
                >
                  {filteredPlaces.map((place, placeIndexInGroup) => (
                    <div key={place.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      {dragOverPlaceId === place.id && draggedPlaceId !== place.id && (
                        <div style={{
                          position: 'absolute',
                          top: dragOverPlacePosition === 'top' ? '-6px' : 'auto',
                          bottom: dragOverPlacePosition === 'bottom' ? '-6px' : 'auto',
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: 'var(--accent-primary)',
                          borderRadius: '2px',
                          boxShadow: '0 0 8px var(--accent-primary)',
                          zIndex: 10,
                          pointerEvents: 'none'
                        }} />
                      )}
                      <div 
                        className={`catalog-place-card ${activePlaceDropdownId === place.id ? 'dropdown-active' : ''} ${activePlaceId === place.id ? 'details-expanded' : ''}`}
                        draggable={trip.canEdit !== false}
                        onDragStart={() => handlePlaceDragStart(place.id)}
                        onDragEnd={() => {
                          setDraggedPlaceId(null);
                          setDragOverPlaceId(null);
                          setDragOverGroupId(null);
                        }}
                        onDragOver={(e) => {
                          if (!draggedPlaceId || draggedPlaceId === place.id) return;
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relativeY = e.clientY - rect.top;
                          const position = relativeY < rect.height / 2 ? 'top' : 'bottom';
                          
                          if (dragOverPlaceId !== place.id || dragOverPlacePosition !== position) {
                            setDragOverPlaceId(place.id);
                            setDragOverPlacePosition(position);
                          }
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handlePlaceDropOnPlace(place.id, group.id, dragOverPlacePosition);
                          setDragOverPlaceId(null);
                        }}
                        onClick={() => setActivePlaceId(activePlaceId === place.id ? undefined : place.id)}
                        style={{ 
                          borderColor: activePlaceId === place.id ? 'var(--accent-primary)' : 'var(--border-glass)',
                          cursor: 'grab'
                        }}
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
                              <MapPin size={16} style={{ color: 'var(--text-muted)' }} />
                            </div>
                          )}
                          <div className="place-card-info" style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '6px' }}>
                              <h4 className="place-card-title" style={{ margin: 0, flex: 1, minWidth: 0 }}>{place.title}</h4>
                              {(() => {
                                const allocatedDays = placeAllocatedDaysMap.get(place.id) || [];
                                if (allocatedDays.length === 0) return null;
                                return (
                                  <div style={{ display: 'flex', gap: '3px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '120px' }}>
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
                              <div className="place-card-hours" style={{ marginTop: '2px' }}>
                                <Clock size={10} /> {place.openingHours}
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
                                draggable={false}
                                onDragStart={e => e.stopPropagation()}
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button 
                                className="mini-icon-btn" 
                                disabled={placeIndexInGroup === filteredPlaces.length - 1} 
                                onClick={() => handleMoveCatalogPlace(place.id, 'down')}
                                style={{ opacity: placeIndexInGroup === filteredPlaces.length - 1 ? 0.3 : 1 }}
                                data-tooltip="Move Down"
                                draggable={false}
                                onDragStart={e => e.stopPropagation()}
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        {trip.canEdit !== false && (
                          <div 
                            className="catalog-place-dropdown-container-mobile"
                            style={{ position: 'absolute', top: '0', right: '0' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button 
                              className="mini-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePlaceDropdownId(activePlaceDropdownId === place.id ? null : place.id);
                              }}
                              data-tooltip="Place Options"
                              style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <MoreVertical size={14} />
                            </button>
                            {activePlaceDropdownId === place.id && (
                              <div className="dropdown-menu" style={{ right: 0, top: '100%', marginTop: '4px' }}>
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
                        {activePlaceId === place.id && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }} onClick={e => e.stopPropagation()}>
                            {place.description && <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.3, textTransform: 'none' }}>{place.description}</p>}
                            
                            {/* Notes Field (Shared at Trip level) */}
                            <div style={{ margin: '8px 0', padding: '6px 8px', background: 'rgba(99,102,241,0.04)', borderLeft: '2px solid var(--accent-primary)', borderRadius: '0 4px 4px 0' }}>
                              <label style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <FileText size={11} /> Notes
                                {trip.canEdit !== false && editingPlaceNotesId !== place.id && (
                                  <button
                                    className="mini-icon-btn"
                                    onClick={() => startEditingNotes(place)}
                                    style={{ marginLeft: 'auto', padding: '4px' }}
                                    data-tooltip="Edit Note"
                                    aria-label="Edit Note"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                              </label>

                              {editingPlaceNotesId === place.id && trip.canEdit !== false ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                  <textarea
                                    value={tempNotes}
                                    onChange={(e) => setTempNotes(e.target.value)}
                                    placeholder="Add notes..."
                                    rows={3}
                                    style={{
                                      padding: '6px',
                                      fontSize: '12.5px',
                                      width: '100%',
                                      background: 'var(--bg-dark)',
                                      border: '1px solid var(--border-glass)',
                                      color: 'var(--text-primary)',
                                      borderRadius: '4px'
                                    }}
                                  />
                                  <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                                    <button 
                                      className="btn-secondary" 
                                      onClick={() => setEditingPlaceNotesId(null)} 
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      className="btn-primary flex-align" 
                                      onClick={() => savePlaceNotes(place.id)} 
                                      style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                                    >
                                      <Check size={12} /> Save Notes
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span style={{
                                  fontStyle: 'italic',
                                  color: place.notes ? 'var(--text-primary)' : 'var(--text-muted)',
                                  whiteSpace: 'pre-wrap',
                                  display: 'block',
                                  lineHeight: 1.4,
                                  fontSize: '12.5px'
                                }}>
                                  {place.notes || 'No notes added yet.'}
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginBottom: '8px' }}>
                              <a 
                                href={place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, catalogLocation?.city)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn-secondary flex-align"
                                style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', textDecoration: 'none', borderRadius: '8px', whiteSpace: 'nowrap' }}
                              >
                                Map <ExternalLink size={10} />
                              </a>
                              {trip.canEdit !== false && (
                                <div className="catalog-place-actions-desktop" style={{ display: 'flex', gap: '4px' }}>
                                  <button 
                                    className="btn-secondary flex-align"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenEditPlace(place);
                                    }}
                                    style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', borderRadius: '8px', whiteSpace: 'nowrap' }}
                                    data-tooltip="Edit Place Details"
                                  >
                                    <Edit2 size={12} /> Edit
                                  </button>
                                  <button 
                                    className="btn-primary" 
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '8px', whiteSpace: 'nowrap' }}
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
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {/* AI Suggestions Group */}
          {aiSuggestionsError && aiSuggestionsLocId === selectedCatalogLocId && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px', color: '#f87171', marginTop: '4px' }}>
              {aiSuggestionsError}
            </div>
          )}
          {(isLoadingAiSuggestions || aiSuggestedPlaces.length > 0) && aiSuggestionsLocId === selectedCatalogLocId && (
            <div ref={aiSuggestionsRef} className="place-group-section" style={{ borderTop: '1px dashed rgba(167,139,250,0.25)', marginTop: '8px', paddingTop: '8px' }}>
              <div className="place-group-header">
                <span className="place-group-title">
                  <Sparkles size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />
                  <span style={{ color: '#c4b5fd' }}>AI Suggestions</span>
                </span>
                <div className="flex-align" style={{ gap: '4px' }}>
                  <button
                    className="mini-icon-btn"
                    onClick={onAiSuggestPlaces}
                    disabled={isLoadingAiSuggestions}
                    data-tooltip="Refresh AI Suggestions"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', padding: 0, color: '#a78bfa' }}
                  >
                    <RefreshCw size={13} className={isLoadingAiSuggestions ? 'spin' : ''} />
                  </button>
                  <span className="badge" style={{ background: 'rgba(167,139,250,0.12)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.25)' }}>
                    {aiSuggestedPlaces.length}
                  </span>
                </div>
              </div>

              {isLoadingAiSuggestions && aiSuggestedPlaces.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 4px', color: '#a78bfa', fontSize: '12px', textTransform: 'none' }}>
                  <RefreshCw size={13} className="spin" style={{ flexShrink: 0 }} />
                  Asking Gemini for place suggestions...
                </div>
              )}
              <div className="catalog-places-list">
                {aiSuggestedPlaces.map(place => (
                  <div key={place.id}>
                    <div
                      className={`catalog-place-card ${activePlaceId === place.id ? 'details-expanded' : ''}`}
                      onClick={() => setActivePlaceId(activePlaceId === place.id ? undefined : place.id)}
                      style={{
                        borderColor: activePlaceId === place.id ? '#a78bfa' : 'rgba(167,139,250,0.15)',
                        background: 'rgba(167,139,250,0.04)',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="place-card-header">
                        {place.photoUrl ? (
                          <div className="place-card-thumb-container">
                            <img src={place.photoUrl} alt="" loading="lazy" decoding="async" />
                          </div>
                        ) : (
                          <div className="place-card-thumb-container">
                            <Sparkles size={14} style={{ color: '#a78bfa' }} />
                          </div>
                        )}
                        <div className="place-card-info" style={{ minWidth: 0, flex: 1 }}>
                          <h4 className="place-card-title" style={{ margin: 0 }}>{place.title}</h4>
                          {place.openingHours && (
                            <div className="place-card-hours" style={{ marginTop: '2px' }}>
                              <Clock size={10} /> {place.openingHours}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {activePlaceId === place.id && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(167,139,250,0.12)', fontSize: '13px' }} onClick={e => e.stopPropagation()}>
                          {place.description && (
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.3, textTransform: 'none' }}>{place.description}</p>
                          )}
                          {place.notes && (
                            <div style={{ margin: '8px 0', padding: '6px 8px', background: 'rgba(167,139,250,0.06)', borderLeft: '2px solid #a78bfa', borderRadius: '0 4px 4px 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4, fontStyle: 'italic', textTransform: 'none' }}>
                              {place.notes}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                            <a
                              href={place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, catalogLocation?.city)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary flex-align"
                              style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', textDecoration: 'none', borderRadius: '8px', whiteSpace: 'nowrap' }}
                            >
                              Map <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '40px 20px', textTransform: 'none', color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px' }}>
          Add locations above to start building your Catalog.
        </div>
      )}
    </div>
  );
}
