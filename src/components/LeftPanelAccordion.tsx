import { ArrowLeft, BookOpen, CheckSquare, Building, Sparkles } from 'lucide-react';
import type { Trip, Plan, Location, Place, PlaceGroup } from '../types';
import CatalogSection from './CatalogSection';
import ChecklistSection from './ChecklistSection';
import ReservationsSection from './ReservationsSection';
import TipsSection from './TipsSection';

interface LeftPanelAccordionProps {
  onBack: () => void;
  activeMobileTab: 'catalog' | 'itinerary' | 'map';
  expandedLeftSection: 'catalog' | 'checklist' | 'reservations' | 'tips';
  setExpandedLeftSection: (section: 'catalog' | 'checklist' | 'reservations' | 'tips') => void;
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
  generatingChecklist: boolean;
  onGenerateTripChecklist: () => void;
  onSaveAiChecklist: (content: string) => void;
  onUpdateTrip: (updatedTrip: Trip | ((prevTrip: Trip) => Trip)) => void;
  daysList: string[];
  generatingLocalEssentials: boolean;
  onGenerateLocalEssentials: () => void;
  onSaveLocalEssentials: (content: string) => void;
  formatDisplayDate: (dateStr: string) => string;
}

export default function LeftPanelAccordion({
  onBack,
  activeMobileTab,
  expandedLeftSection,
  setExpandedLeftSection,
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
  generatingChecklist,
  onGenerateTripChecklist,
  onSaveAiChecklist,
  onUpdateTrip,
  daysList,
  generatingLocalEssentials,
  onGenerateLocalEssentials,
  onSaveLocalEssentials,
  formatDisplayDate
}: LeftPanelAccordionProps) {
  return (
    <div className={`catalog-panel left-panel-accordion ${activeMobileTab === 'catalog' ? 'mobile-active' : ''}`}>
      {/* Back to dashboard button (always visible at the top) */}
      <button 
        className="mini-icon-btn" 
        onClick={onBack} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          fontSize: '12px', 
          width: 'fit-content',
          padding: '6px 10px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '6px',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          marginBottom: '4px'
        }}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </button>

      {/* Accordion Section 1: Catalog */}
      <div className={`accordion-section ${expandedLeftSection === 'catalog' ? 'expanded' : 'collapsed'}`}>
        <div 
          className="accordion-header flex-between"
          onClick={() => setExpandedLeftSection('catalog')}
        >
          <span className="flex-align" style={{ gap: '8px', fontSize: '14px', fontWeight: 600 }}>
            <BookOpen size={16} style={{ color: 'var(--accent-primary)' }} />
            Catalog
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {catalogLocation ? `${catalogLocation.places.length} places` : 'Empty'}
          </span>
        </div>
        
        {expandedLeftSection === 'catalog' && (
          <CatalogSection
            trip={trip}
            catalogLocation={catalogLocation}
            selectedCatalogLocId={selectedCatalogLocId}
            setSelectedCatalogLocId={setSelectedCatalogLocId}
            hideAllocatedPlaces={hideAllocatedPlaces}
            setHideAllocatedPlaces={setHideAllocatedPlaces}
            activePlaceId={activePlaceId}
            setActivePlaceId={setActivePlaceId}
            placeAllocatedDaysMap={placeAllocatedDaysMap}
            getCachedFormattedDisplayDate={getCachedFormattedDisplayDate}
            activeDayStr={activeDayStr}
            activePlan={activePlan}
            onEditLocation={onEditLocation}
            onAddLocation={onAddLocation}
            onAddPlaceToDay={onAddPlaceToDay}
            onOpenEditPlace={onOpenEditPlace}
            draggedPlaceId={draggedPlaceId}
            dragOverGroupId={dragOverGroupId}
            dragOverPlaceId={dragOverPlaceId}
            dragOverPlacePosition={dragOverPlacePosition}
            setDraggedPlaceId={setDraggedPlaceId}
            setDragOverGroupId={setDragOverGroupId}
            setDragOverPlaceId={setDragOverPlaceId}
            setDragOverPlacePosition={setDragOverPlacePosition}
            handlePlaceDragStart={handlePlaceDragStart}
            handlePlaceDropOnGroup={handlePlaceDropOnGroup}
            handlePlaceDropOnPlace={handlePlaceDropOnPlace}
            handleMoveCatalogPlace={handleMoveCatalogPlace}
            handleMoveGroupOrder={handleMoveGroupOrder}
            startEditingGroup={startEditingGroup}
            setShowGroupModal={setShowGroupModal}
            setAiGeneratePlaces={setAiGeneratePlaces}
            setAiGenerateCity={setAiGenerateCity}
            setAiGenerateCountry={setAiGenerateCountry}
            setShowAiGenerateModal={setShowAiGenerateModal}
            setEditingPlace={setEditingPlace}
            setShowCustomPlaceModal={setShowCustomPlaceModal}
            setAutoScheduleOnActiveDay={setAutoScheduleOnActiveDay}
            editingPlaceNotesId={editingPlaceNotesId}
            setEditingPlaceNotesId={setEditingPlaceNotesId}
            tempNotes={tempNotes}
            setTempNotes={setTempNotes}
            startEditingNotes={startEditingNotes}
            savePlaceNotes={savePlaceNotes}
            activeGroupDropdownId={activeGroupDropdownId}
            setActiveGroupDropdownId={setActiveGroupDropdownId}
          />
        )}
      </div>

      {/* Accordion Section 2: Checklist */}
      <div className={`accordion-section ${expandedLeftSection === 'checklist' ? 'expanded' : 'collapsed'}`}>
        <div 
          className="accordion-header flex-between"
          onClick={() => setExpandedLeftSection(expandedLeftSection === 'checklist' ? 'catalog' : 'checklist')}
        >
          <span className="flex-align" style={{ gap: '8px', fontSize: '14px', fontWeight: 600 }}>
            <CheckSquare size={16} style={{ color: 'var(--accent-secondary)' }} />
            Checklist
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {(() => {
              const total = (activePlan.manualChecklist || []).length;
              const done = (activePlan.manualChecklist || []).filter(c => c.completed).length;
              return `${done}/${total} done`;
            })()}
          </span>
        </div>
        
        {expandedLeftSection === 'checklist' && (
          <ChecklistSection
            trip={trip}
            activePlan={activePlan}
            generatingChecklist={generatingChecklist}
            onGenerateTripChecklist={onGenerateTripChecklist}
            onSaveAiChecklist={onSaveAiChecklist}
            onUpdateTrip={onUpdateTrip}
          />
        )}
      </div>

      {/* Accordion Section 3: Reservations */}
      <div className={`accordion-section ${expandedLeftSection === 'reservations' ? 'expanded' : 'collapsed'}`}>
        <div 
          className="accordion-header flex-between"
          onClick={() => setExpandedLeftSection(expandedLeftSection === 'reservations' ? 'catalog' : 'reservations')}
        >
          <span className="flex-align" style={{ gap: '8px', fontSize: '14px', fontWeight: 600 }}>
            <Building size={16} style={{ color: 'var(--color-success)' }} />
            Reservations
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {(() => {
              const hotelsCount = activePlan.hotels.length;
              const transitCount = activePlan.transports.length;
              return `${hotelsCount}H / ${transitCount}T`;
            })()}
          </span>
        </div>
        
        {expandedLeftSection === 'reservations' && (
          <ReservationsSection
            trip={trip}
            activePlan={activePlan}
            daysList={daysList}
            onPlaceClick={(id) => {
              setExpandedLeftSection('catalog');
              setActivePlaceId(id);
            }}
            formatDisplayDate={formatDisplayDate}
          />
        )}
      </div>

      {/* Accordion Section 4: Tips */}
      <div className={`accordion-section ${expandedLeftSection === 'tips' ? 'expanded' : 'collapsed'}`}>
        <div 
          className="accordion-header flex-between"
          onClick={() => setExpandedLeftSection(expandedLeftSection === 'tips' ? 'catalog' : 'tips')}
        >
          <span className="flex-align" style={{ gap: '8px', fontSize: '14px', fontWeight: 600 }}>
            <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            Tips (Local Essentials)
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {catalogLocation && catalogLocation.aiDetails?.local_essentials ? 'Ready' : 'Empty'}
          </span>
        </div>
        
        {expandedLeftSection === 'tips' && (
          <TipsSection
            trip={trip}
            catalogLocation={catalogLocation}
            selectedCatalogLocId={selectedCatalogLocId}
            setSelectedCatalogLocId={setSelectedCatalogLocId}
            generatingLocalEssentials={generatingLocalEssentials}
            onGenerateLocalEssentials={onGenerateLocalEssentials}
            onSaveLocalEssentials={onSaveLocalEssentials}
          />
        )}
      </div>
    </div>
  );
}
