import { Plus, Link } from 'lucide-react';
import SectionHeader from './SectionHeader';
import GroupActionButton from './GroupActionButton';
import GroupOptionsMenu from './GroupOptionsMenu';
import type { Trip, Plan, ExpenseGroup, ExpenseItem, Hotel, TransportationReservation, PlaceReservation } from '../types';
import { getExpenseGroupIcon, getExpenseReservationDates } from '../utils/expenseUtils';
import { getHotelResolvedLocation, getTransitResolvedLocations } from '../utils/locationUtils';
import { compareCurrencies } from '../utils/currencies';

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const shortDate = (d: string) => {
  if (!d) return '';
  return new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isValidDateStr = (d?: string): d is string =>
  !!d && !isNaN(new Date(d + 'T00:00').getTime());

interface ExpensesPanelProps {
  trip: Trip;
  activePlan: Plan;
  onAddExpense: (groupId: string) => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onAddExpenseGroup: () => void;
  onEditExpenseGroup: (group: ExpenseGroup) => void;
  onMoveExpenseGroup: (index: number, direction: 'up' | 'down') => void;
  activeDayStr?: string;
}

export default function ExpensesPanel({
  trip,
  activePlan,
  onAddExpense,
  onEditExpense,
  onAddExpenseGroup,
  onEditExpenseGroup,
  onMoveExpenseGroup,
  activeDayStr
}: ExpensesPanelProps) {

  // Pull virtual reservation expenses
  const hotels: Hotel[] = activePlan.hotels || [];
  const transports: TransportationReservation[] = activePlan.transports || [];
  const placeReservations: PlaceReservation[] = activePlan.placeReservations || [];

  // Helper to format transport summary name
  const getTransportTitle = (r: TransportationReservation) => {
    if (r.name) return r.name;
    const typeStr = r.type.charAt(0).toUpperCase() + r.type.slice(1);
    if (r.segments && r.segments.length > 0) {
      const first = r.segments[0];
      const last = r.segments[r.segments.length - 1];
      return `${typeStr}: ${first.departureLocationName} → ${last.arrivalLocationName}`;
    }
    return `${typeStr} Reservation`;
  };

  const hotelVirtualExpenses: ExpenseItem[] = hotels.map(h => ({
    id: h.id,
    title: h.name,
    notes: h.notes,
    groupId: 'hotels',
    linkedReservationId: h.id,
    linkedReservationType: 'hotel',
    lineItems: h.expenses || []
  }));

  const transitVirtualExpenses: ExpenseItem[] = transports.map(t => ({
    id: t.id,
    title: getTransportTitle(t),
    notes: t.notes,
    groupId: 'transports',
    linkedReservationId: t.id,
    linkedReservationType: 'transit',
    lineItems: t.expenses || []
  }));

  const placeVirtualExpenses: ExpenseItem[] = placeReservations.map(pr => ({
    id: pr.id,
    title: pr.title,
    notes: pr.notes,
    date: pr.date,
    groupId: pr.type === 'attraction' ? 'attractions' : 'dining',
    linkedReservationId: pr.id,
    linkedReservationType: 'place',
    lineItems: pr.expenses || []
  }));

  const manualExpenses: ExpenseItem[] = activePlan.expenses || [];

  // All merged expenses
  const allMergedExpenses = [
    ...manualExpenses,
    ...hotelVirtualExpenses,
    ...transitVirtualExpenses,
    ...placeVirtualExpenses
  ];

  // Calculate totals
  const totalPaid: Record<string, number> = {};
  const totalUnpaid: Record<string, number> = {};
  const totalOverall: Record<string, number> = {};

  allMergedExpenses.forEach(exp => {
    (exp.lineItems || []).forEach(line => {
      const currency = line.currency || 'USD';
      totalOverall[currency] = (totalOverall[currency] || 0) + line.price;
      if (line.paid) {
        totalPaid[currency] = (totalPaid[currency] || 0) + line.price;
      } else {
        totalUnpaid[currency] = (totalUnpaid[currency] || 0) + line.price;
      }
    });
  });

  const expenseGroups: ExpenseGroup[] = activePlan.expenseGroups || [];

  // Group totals breakdown
  const groupTotals: Record<string, Record<string, number>> = {};
  expenseGroups.forEach(g => {
    groupTotals[g.id] = {};
  });

  allMergedExpenses.forEach(exp => {
    const gid = exp.groupId;
    if (!groupTotals[gid]) {
      groupTotals[gid] = {};
    }
    (exp.lineItems || []).forEach(line => {
      const currency = line.currency || 'USD';
      groupTotals[gid][currency] = (groupTotals[gid][currency] || 0) + line.price;
    });
  });

  const formatPrice = (amount: number) => {
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  };

  const getSortableDate = (item: ExpenseItem) => {
    if (item.date) return item.date;
    if (item.linkedReservationId) {
      if (item.linkedReservationType === 'hotel') {
        const h = hotels.find(x => x.id === item.linkedReservationId);
        if (h) return h.checkInDate || '';
      } else if (item.linkedReservationType === 'transit') {
        const t = transports.find(x => x.id === item.linkedReservationId);
        if (t && t.segments && t.segments.length > 0) {
          return t.segments[0].departureDate || '';
        }
      } else if (item.linkedReservationType === 'place') {
        const pr = placeReservations.find(x => x.id === item.linkedReservationId);
        if (pr) return pr.date || '';
      }
    }
    return '';
  };

  const getGroupColor = (g: ExpenseGroup) => {
    if (g.color) return g.color;
    if (g.id === 'hotels') return '#10b981';
    if (g.id === 'transports') return '#f59e0b';
    if (g.id === 'attractions') return '#ef4444';
    if (g.id === 'dining') return '#3b82f6';
    return 'var(--accent-primary)';
  };

  return (
    <>
      {/* Header — pinned above the scroll area, never scrolls */}
      <div className="subsection-header catalog-groups-header catalog-groups-header--pinned">
        <h4 className="subsection-title catalog-groups-label">Trip Expenses</h4>
        <div className="subsection-actions catalog-groups-right">
          {trip.canEdit !== false && (
            <button
              className="mini-icon-btn catalog-add-group-btn"
              onClick={onAddExpenseGroup}
              data-tooltip="Add Expense Group"
              data-tooltip-position="bottom"
            >
              <Plus size={14} /> Add Group
            </button>
          )}
        </div>
      </div>

      <div className="accordion-content">
      {/* Top Summary Card */}
      <div
        className="expenses-summary-card glass-panel"
        style={{
          margin: '0 0 12px 0',
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <h4 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
          Trip Total & Breakdown
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Paid</span>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {Object.keys(totalPaid).length > 0 ? (
                Object.entries(totalPaid)
                  .sort(([codeA], [codeB]) => compareCurrencies(codeA, codeB))
                  .map(([curr, val]) => (
                    <div key={curr}>{formatPrice(val)} {curr}</div>
                  ))
              ) : (
                <div>0.00</div>
              )}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Unpaid</span>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {Object.keys(totalUnpaid).length > 0 ? (
                Object.entries(totalUnpaid)
                  .sort(([codeA], [codeB]) => compareCurrencies(codeA, codeB))
                  .map(([curr, val]) => (
                    <div key={curr}>{formatPrice(val)} {curr}</div>
                  ))
              ) : (
                <div>0.00</div>
              )}
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Total Budget</span>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {Object.keys(totalOverall).length > 0 ? (
              Object.entries(totalOverall)
                .sort(([codeA], [codeB]) => compareCurrencies(codeA, codeB))
                .map(([curr, val]) => (
                  <div key={curr}>{formatPrice(val)} {curr}</div>
                ))
            ) : (
              <div>0.00</div>
            )}
          </div>
        </div>

        {/* Group Breakdown */}
        <div style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>By Groups</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {expenseGroups.map(g => {
              const sum = groupTotals[g.id] || {};
              const gColor = getGroupColor(g);
              return (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {getExpenseGroupIcon(g.icon, 11, '', { color: gColor })}
                    <span>{g.name}</span>
                  </span>
                  <div style={{ fontWeight: 500, textAlign: 'right' }}>
                    {Object.keys(sum).length > 0 ? (
                      Object.entries(sum)
                        .sort(([codeA], [codeB]) => compareCurrencies(codeA, codeB))
                        .map(([curr, val]) => (
                          <div key={curr}>{formatPrice(val)} {curr}</div>
                        ))
                    ) : (
                      <div>0.00</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

         {/* Groups List */}
        <div style={{ padding: '0 0 12px 0', display: 'flex', flexDirection: 'column' }}>
          {expenseGroups.map((group, groupIdx) => {
            const isFirst = groupIdx === 0;
            const isLast = groupIdx === expenseGroups.length - 1;
            const showAbove = groupIdx >= Math.max(1, expenseGroups.length - 2);
            const gColor = getGroupColor(group);

            const itemsInGroup = allMergedExpenses
              .filter(e => e.groupId === group.id)
              .sort((a, b) => {
                const dateA = getSortableDate(a);
                const dateB = getSortableDate(b);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateA.localeCompare(dateB);
              });

            return (
              <div key={group.id} className="place-group-section">
                {/* Group Header */}
                <SectionHeader
                  variant="group"
                  glyph={getExpenseGroupIcon(group.icon, 14, '', { color: gColor })}
                  title={group.name}
                  titleAttr={group.name}
                  actions={trip.canEdit !== false && <>
                    <GroupActionButton
                      icon={Plus}
                      label="Add"
                      labeled
                      tooltip={`Add Expense to ${group.name}`}
                      onClick={() => onAddExpense(group.id)}
                    />
                    <GroupOptionsMenu
                      showAbove={showAbove}
                      disableUp={isFirst}
                      disableDown={isLast}
                      onMoveUp={() => onMoveExpenseGroup(groupIdx, 'up')}
                      onMoveDown={() => onMoveExpenseGroup(groupIdx, 'down')}
                      onEdit={() => onEditExpenseGroup(group)}
                    />
                  </>}
                />

                {/* Group Items */}
                <div className="catalog-places-list">
                  {itemsInGroup.length > 0 ? (
                    itemsInGroup.map(item => {
                      const isLinked = !!item.linkedReservationId;
                      const unpaid = (item.lineItems || []).filter(l => !l.paid).length;

                      const { startDate, endDate } = getExpenseReservationDates(item, hotels, transports, placeReservations);
                      const isInRange = !!activeDayStr && startDate && endDate && activeDayStr >= startDate && activeDayStr <= endDate;

                      const isHotel = isLinked && item.linkedReservationType === 'hotel';
                      const isTransit = isLinked && item.linkedReservationType === 'transit';
                      const isPlace = isLinked && item.linkedReservationType === 'place';
                      const linkedPlaceReservation = isPlace ? placeReservations.find(x => x.id === item.linkedReservationId) : undefined;
                      const isDining = linkedPlaceReservation?.type === 'dining';

                      // Resolve location(s) using shared helpers
                      const resolvedLocations = (() => {
                        if (isHotel) {
                          const hotel = hotels.find(x => x.id === item.linkedReservationId);
                          if (hotel) {
                            const loc = getHotelResolvedLocation(hotel, activePlan.days, trip.locations);
                            return loc ? { departureLocation: loc, arrivalLocation: loc } : { departureLocation: undefined, arrivalLocation: undefined };
                          }
                        } else if (isTransit) {
                          const transport = transports.find(x => x.id === item.linkedReservationId);
                          if (transport && transport.segments && transport.segments.length > 0) {
                            const firstSeg = transport.segments[0];
                            const lastSeg = transport.segments[transport.segments.length - 1];
                            return getTransitResolvedLocations(firstSeg.departureDate, lastSeg.arrivalDate, activePlan.days, trip.locations);
                          }
                        } else if (item.date) {
                          const locId = activePlan.days[item.date]?.locationId;
                          const loc = locId ? trip.locations.find(l => l.id === locId) : undefined;
                          return loc ? { departureLocation: loc, arrivalLocation: loc } : { departureLocation: undefined, arrivalLocation: undefined };
                        }
                        return { departureLocation: undefined, arrivalLocation: undefined };
                      })();
                      const { departureLocation: depLoc, arrivalLocation: arrLoc } = resolvedLocations;

                      return (
                        <div
                          key={item.id}
                          className="catalog-place-card glass-panel"
                          onClick={() => onEditExpense(item)}
                          style={{
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, paddingRight: '8px' }}>
                              {item.title}
                            </h5>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '12px', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {(() => {
                                const currencyStatus = (item.lineItems || []).reduce((acc, l) => {
                                  const curr = l.currency || 'USD';
                                  if (!acc[curr]) {
                                    acc[curr] = { total: 0, hasUnpaid: false };
                                  }
                                  acc[curr].total += l.price;
                                  if (!l.paid) {
                                    acc[curr].hasUnpaid = true;
                                  }
                                  return acc;
                                }, {} as Record<string, { total: number; hasUnpaid: boolean }>);

                                return Object.keys(currencyStatus).length > 0 ? (
                                  Object.entries(currencyStatus)
                                    .sort(([codeA], [codeB]) => compareCurrencies(codeA, codeB))
                                    .map(([curr, status]) => (
                                      <div key={curr} style={{ color: status.hasUnpaid ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                                        {formatPrice(status.total)} {curr}
                                      </div>
                                    ))
                                ) : (
                                  <div style={{ color: 'var(--text-primary)' }}>0.00</div>
                                );
                              })()}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', gap: '6px', width: '100%' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflow: 'hidden', flexShrink: 1, minWidth: 0 }}>
                              {/* Linked Tag */}
                              {isLinked && (() => {
                                 const tagHex = isHotel ? '#10b981' : isTransit ? '#f59e0b' : isPlace ? (isDining ? '#3b82f6' : '#ef4444') : '#6366f1';
                                 const tagLabel = isHotel ? 'Hotel' : isTransit ? 'Transit' : isPlace ? (isDining ? 'Dining' : 'Attraction') : 'Linked';
                                 return (
                                   <span
                                     className="catalog-day-tag"
                                     style={{
                                       fontSize: '9px',
                                       padding: '1px 5px',
                                       color: tagHex,
                                       background: hexToRgba(tagHex, 0.08),
                                       border: `1px solid ${hexToRgba(tagHex, 0.2)}`,
                                       display: 'inline-flex',
                                       alignItems: 'center',
                                       gap: '3px',
                                       flexShrink: 0
                                     }}
                                   >
                                     <Link size={8} />
                                     <span>{tagLabel}</span>
                                   </span>
                                 );
                              })()}

                              {/* Location Tag(s) */}
                              {(() => {
                                const renderLocTag = (loc: typeof trip.locations[0]) => {
                                  const tagColor = loc.color || 'var(--accent-primary)';
                                  const hexColor = loc.color || '#6366f1';
                                  const tagBg = hexToRgba(hexColor, 0.08);
                                  const tagBorder = `1px solid ${hexToRgba(hexColor, 0.2)}`;
                                  return (
                                    <span
                                      className="catalog-day-tag"
                                      style={{
                                        fontSize: '9px',
                                        padding: '1px 5px',
                                        color: tagColor,
                                        background: tagBg,
                                        border: tagBorder,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        maxWidth: '120px',
                                        minWidth: 0,
                                        flexShrink: 1
                                      }}
                                    >
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {loc.city}
                                      </span>
                                    </span>
                                  );
                                };

                                if (!depLoc && !arrLoc) return null;
                                if (!depLoc) return renderLocTag(arrLoc!);
                                if (!arrLoc) return renderLocTag(depLoc);
                                if (depLoc.id === arrLoc.id) return renderLocTag(depLoc);
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden', minWidth: 0 }}>
                                    {renderLocTag(depLoc)}
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
                                    {renderLocTag(arrLoc)}
                                  </div>
                                );
                              })()}
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                              {/* Date Tags */}
                              {(() => {
                                if (!isValidDateStr(startDate)) return null;

                                if (isHotel) {
                                  return (
                                    <>
                                      <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>
                                        {shortDate(startDate)}
                                      </span>
                                      {isValidDateStr(endDate) && (
                                        <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>
                                          {shortDate(endDate)}
                                        </span>
                                      )}
                                    </>
                                  );
                                } else if (isLinked && item.linkedReservationType === 'transit') {
                                  return (
                                    <>
                                      <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>
                                        {shortDate(startDate)}
                                      </span>
                                      {isValidDateStr(endDate) && startDate !== endDate && (
                                        <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>
                                          {shortDate(endDate)}
                                        </span>
                                      )}
                                    </>
                                  );
                                } else {
                                  // Non-linked
                                  return (
                                    <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>
                                      {shortDate(startDate)}
                                    </span>
                                  );
                                }
                              })()}

                              {unpaid > 0 && (
                                <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 500 }}>
                                  {unpaid} unpaid
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>
                      No expenses added.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
