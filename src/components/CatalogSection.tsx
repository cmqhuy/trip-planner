import { useState, useEffect } from 'react';
import { 
  MapPin, Plus, Edit2, ExternalLink, ChevronUp, ChevronDown, 
  Clock, FileText, Sparkles, MoreVertical, Check
} from 'lucide-react';
import type { Trip, Plan, Location, Place, PlaceGroup } from '../types';
import { DEFAULT_PLACE_GROUPS, getFormattedLocationName, getLocIcon, buildMapsLink } from '../utils/api';
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
  setActiveGroupDropdownId
}: CatalogSectionProps) {
  const [activePlaceDropdownId, setActivePlaceDropdownId] = useState<string | null>(null);

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
          <select
            value={selectedCatalogLocId}
            onChange={(e) => setSelectedCatalogLocId(e.target.value)}
            className="catalog-location-select"
            style={{ flex: 1, padding: '6px 28px 6px 10px', fontSize: '12px', background: 'var(--bg-dark)', minWidth: 0 }}
          >
            {trip.locations.length === 0 && <option value="">No Locations Added</option>}
            {trip.locations.map(loc => (
              <option key={loc.id} value={loc.id}>{getLocIcon(loc)} {getFormattedLocationName(loc, trip.locations)}</option>
            ))}
          </select>
          
          {catalogLocation && trip.canEdit !== false && (
            <button 
              className="mini-icon-btn" 
              onClick={onEditLocation}
              data-tooltip="Edit Location Settings"
              style={{ padding: '6px', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Edit2 size={12} />
            </button>
          )}
          {trip.canEdit !== false && (
            <button 
              className="btn-primary flex-align mini-icon-btn add-location-btn"
              style={{ padding: '6px', fontSize: '11px', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onClick={onAddLocation}
              data-tooltip="Add Location"
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
                  data-tooltip="Add Custom Category"
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
                    {group.name}
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
                          style={{ padding: '2px', color: '#a5b4fc', display: 'flex', alignItems: 'center' }}
                        >
                          <Sparkles size={12} />
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
                          style={{ padding: '2px' }}
                        >
                          <Plus size={10} />
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
                            padding: '6px', 
                            height: '28px', 
                            width: '28px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
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
                        className={`catalog-place-card ${activePlaceDropdownId === place.id ? 'dropdown-active' : ''}`}
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
                            <img 
                              src={getOptimizedImageUrl(place.photoUrl, 120)} 
                              className="place-card-thumb" 
                              alt="" 
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div 
                              className="place-card-thumb" 
                              style={{ 
                                background: 'rgba(255,255,255,0.05)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center'
                              }}
                            >
                              <MapPin size={16} />
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
                              className="catalog-place-actions-desktop"
                              style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: 'center', flexShrink: 0 }} 
                              onClick={e => e.stopPropagation()}
                            >
                              <button 
                                className="mini-icon-btn" 
                                disabled={placeIndexInGroup === 0} 
                                onClick={() => handleMoveCatalogPlace(place.id, 'up')}
                                style={{ opacity: placeIndexInGroup === 0 ? 0.3 : 1, padding: '2px' }}
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
                                style={{ opacity: placeIndexInGroup === filteredPlaces.length - 1 ? 0.3 : 1, padding: '2px' }}
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
                                      fontSize: '13px', 
                                      width: '100%', 
                                      background: 'var(--bg-dark)', 
                                      border: '1px solid var(--border-glass)', 
                                      color: 'var(--text-primary)',
                                      borderRadius: '4px',
                                      resize: 'vertical'
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <span style={{ 
                                    fontStyle: 'italic', 
                                    color: place.notes ? 'var(--text-primary)' : 'var(--text-muted)',
                                    whiteSpace: 'pre-wrap',
                                    display: 'block',
                                    width: '100%',
                                    lineHeight: 1.4,
                                    fontSize: '12.5px'
                                  }}>
                                    {place.notes || 'No notes added yet.'}
                                  </span>
                                  {trip.canEdit !== false && (
                                    <button 
                                      className="mini-icon-btn" 
                                      onClick={() => startEditingNotes(place)} 
                                      style={{ padding: '2px' }}
                                      data-tooltip="Edit Note"
                                      aria-label="Edit Note"
                                    >
                                      <Edit2 size={10} />
                                    </button>
                                  )}
                                </div>
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
        </div>
      ) : (
        <div style={{ padding: '40px 20px', textTransform: 'none', color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px' }}>
          Add locations above to start building your Catalog.
        </div>
      )}
    </div>
  );
}
