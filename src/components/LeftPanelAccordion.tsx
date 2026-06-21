import { BookOpen, CheckSquare, Building, Sparkles, AlertTriangle } from 'lucide-react';
import type { Trip, Plan, Location, Place, PlaceGroup, Hotel, TransportationReservation } from '../types';
import CatalogSection from './CatalogSection';
import ChecklistSection from './ChecklistSection';
import ReservationsSection from './ReservationsSection';
import TipsSection from './TipsSection';

interface LeftPanelAccordionProps {
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
  savePlaceNotes: (placeId: string, notes: string) => void;
  activeGroupDropdownId: string | null;
  setActiveGroupDropdownId: (id: string | null) => void;
  aiSuggestedPlaces: Place[];
  isLoadingAiSuggestions: boolean;
  aiSuggestionsLocId: string | null;
  aiSuggestionsError: string | null;
  onAiSuggestPlaces: () => void;
  generatingChecklist: boolean;
  onGenerateTripChecklist: () => void;
  onSaveAiChecklist: (content: string) => void;
  onUpdateTrip: (updatedTrip: Trip | ((prevTrip: Trip) => Trip)) => void;
  daysList: string[];
  generatingLocalEssentials: boolean;
  onGenerateLocalEssentials: () => void;
  onSaveLocalEssentials: (content: string) => void;
  formatDisplayDate: (dateStr: string) => string;
  onEditHotel: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
  onEditTransport: (reservation: TransportationReservation, segmentIndex: number) => void;
  onDeleteTransport: (reservationId: string, segmentIndex: number) => void;
  onSaveTransportNotes: (reservationId: string, notes: string) => void;
  expandedHotelId: string | null;
  setExpandedHotelId: (id: string | null) => void;
  expandedTransitId: string | null;
  setExpandedTransitId: (id: string | null) => void;
  onAddHotel: () => void;
  onAddTransit: () => void;
  onImportReservationFile: (type: 'hotel' | 'transit', file: File) => void;
}

export default function LeftPanelAccordion({
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
  savePlaceNotes,
  activeGroupDropdownId,
  setActiveGroupDropdownId,
  aiSuggestedPlaces = [],
  isLoadingAiSuggestions = false,
  aiSuggestionsLocId = null,
  aiSuggestionsError = null,
  onAiSuggestPlaces,
  generatingChecklist,
  onGenerateTripChecklist,
  onSaveAiChecklist,
  onUpdateTrip,
  daysList,
  generatingLocalEssentials,
  onGenerateLocalEssentials,
  onSaveLocalEssentials,
  formatDisplayDate,
  onEditHotel,
  onDeleteHotel,
  onEditTransport,
  onDeleteTransport,
  onSaveTransportNotes,
  expandedHotelId,
  setExpandedHotelId,
  expandedTransitId,
  setExpandedTransitId,
  onAddHotel,
  onAddTransit,
  onImportReservationFile,
}: LeftPanelAccordionProps) {
  return (
    <div className={`catalog-panel left-panel-accordion ${activeMobileTab === 'catalog' ? 'mobile-active' : ''}`}>

      {/* Accordion Section 1: Catalog */}
      <div className={`accordion-section ${expandedLeftSection === 'catalog' ? 'expanded' : 'collapsed'}`}>
        <div 
          className="accordion-header flex-between"
          onClick={() => setExpandedLeftSection('catalog')}
        >
          <span className="flex-align accordion-section-title">
            <BookOpen size={16} className="text-accent" />
            Catalog
          </span>
          <span className="text-muted-sm">
            {catalogLocation ? `${catalogLocation.places.length} place${catalogLocation.places.length === 1 ? '' : 's'}` : 'Empty'}
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
            savePlaceNotes={savePlaceNotes}
            activeGroupDropdownId={activeGroupDropdownId}
            setActiveGroupDropdownId={setActiveGroupDropdownId}
            aiSuggestedPlaces={aiSuggestedPlaces}
            isLoadingAiSuggestions={isLoadingAiSuggestions}
            aiSuggestionsLocId={aiSuggestionsLocId}
            aiSuggestionsError={aiSuggestionsError}
            onAiSuggestPlaces={onAiSuggestPlaces}
          />
        )}
      </div>

      {/* Accordion Section 2: Checklist */}
      <div className={`accordion-section ${expandedLeftSection === 'checklist' ? 'expanded' : 'collapsed'}`}>
        <div 
          className="accordion-header flex-between"
          onClick={() => setExpandedLeftSection(expandedLeftSection === 'checklist' ? 'catalog' : 'checklist')}
        >
          <span className="flex-align accordion-section-title">
            <CheckSquare size={16} className="text-accent-secondary" />
            Checklist
          </span>
          <span className="text-muted-sm">
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
          <span className="flex-align accordion-section-title">
            <Building size={16} className="text-success" />
            Reservations
          </span>
          {(() => {
            const hasHotelWarning = daysList.some(d => {
              const locId = activePlan.days[d]?.locationId;
              const isNoHotel = activePlan.days[d]?.noHotel;
              if (isNoHotel) return false;
              return !!locId && !activePlan.hotels.some(h => h.status !== 'Canceled' && h.checkInDate <= d && d < h.checkOutDate);
            });
            const hasTransitWarning = daysList.some((d, i) => {
              if (i === 0) return false;
              const prevLoc = activePlan.days[daysList[i - 1]]?.locationId;
              const currLoc = activePlan.days[d]?.locationId;
              if (!prevLoc || !currLoc || prevLoc === currLoc) return false;
              return !activePlan.transports.some(
                t => t.status !== 'Canceled' && t.segments.some(s => s.departureDate === daysList[i - 1] || s.arrivalDate === d)
              );
            });
            const hasPendingWarning = activePlan.hotels.some(h => h.status === 'Planning') || activePlan.transports.some(t => t.status === 'Planning');
            return (hasHotelWarning || hasTransitWarning || hasPendingWarning)
              ? <AlertTriangle size={12} className="accordion-warning-icon" />
              : null;
          })()}
        </div>
        
        {expandedLeftSection === 'reservations' && (
          <ReservationsSection
            trip={trip}
            activePlan={activePlan}
            daysList={daysList}
            selectedDateStr={activeDayStr}
            onPlaceClick={(id) => {
              setExpandedLeftSection('catalog');
              setActivePlaceId(id);
            }}
            formatDisplayDate={formatDisplayDate}
            onEditHotel={onEditHotel}
            onDeleteHotel={onDeleteHotel}
            onEditTransport={onEditTransport}
            onDeleteTransport={onDeleteTransport}
            onSaveTransportNotes={onSaveTransportNotes}
            expandedHotelId={expandedHotelId}
            setExpandedHotelId={setExpandedHotelId}
            expandedTransitId={expandedTransitId}
            setExpandedTransitId={setExpandedTransitId}
            onAddHotel={onAddHotel}
            onAddTransit={onAddTransit}
            onImportReservationFile={onImportReservationFile}
          />
        )}
      </div>

      {/* Accordion Section 4: Tips */}
      <div className={`accordion-section ${expandedLeftSection === 'tips' ? 'expanded' : 'collapsed'}`}>
        <div 
          className="accordion-header flex-between"
          onClick={() => setExpandedLeftSection(expandedLeftSection === 'tips' ? 'catalog' : 'tips')}
        >
          <span className="flex-align accordion-section-title">
            <Sparkles size={16} className="text-accent" />
            Tips (Local Essentials)
          </span>
          <span className="text-muted-sm">
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
