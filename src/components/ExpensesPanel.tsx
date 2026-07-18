import { useEffect } from 'react';
import { Plus, MoreVertical, ChevronUp, ChevronDown, Edit2, Link } from 'lucide-react';
import type { Trip, Plan, ExpenseGroup, ExpenseItem, Hotel, TransportationReservation } from '../types';
import { getExpenseGroupIcon } from '../utils/expenseUtils';
import { compareCurrencies } from '../utils/currencies';
import { getFormattedLocationName, getLocIcon } from '../utils/api';

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface ExpensesPanelProps {
  trip: Trip;
  activePlan: Plan;
  onAddExpense: (groupId: string) => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onAddExpenseGroup: () => void;
  onEditExpenseGroup: (group: ExpenseGroup) => void;
  onMoveExpenseGroup: (index: number, direction: 'up' | 'down') => void;
  activeGroupDropdownId: string | null;
  setActiveGroupDropdownId: (id: string | null) => void;
}

export default function ExpensesPanel({
  trip,
  activePlan,
  onAddExpense,
  onEditExpense,
  onAddExpenseGroup,
  onEditExpenseGroup,
  onMoveExpenseGroup,
  activeGroupDropdownId,
  setActiveGroupDropdownId
}: ExpensesPanelProps) {

  // Auto-close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.group-dropdown-container')) {
        setActiveGroupDropdownId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [setActiveGroupDropdownId]);

  // Pull virtual reservation expenses
  const hotels: Hotel[] = activePlan.hotels || [];
  const transports: TransportationReservation[] = activePlan.transports || [];

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

  const manualExpenses: ExpenseItem[] = activePlan.expenses || [];

  // All merged expenses
  const allMergedExpenses = [
    ...manualExpenses,
    ...hotelVirtualExpenses,
    ...transitVirtualExpenses
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
      }
    }
    return '';
  };

  const getBriefDetails = (item: ExpenseItem) => {
    if (item.linkedReservationId) {
      if (item.linkedReservationType === 'hotel') {
        const h = hotels.find(x => x.id === item.linkedReservationId);
        if (h) return `${h.checkInDate} to ${h.checkOutDate}`;
      } else if (item.linkedReservationType === 'transit') {
        const t = transports.find(x => x.id === item.linkedReservationId);
        if (t) {
          const typeStr = t.type.charAt(0).toUpperCase() + t.type.slice(1);
          if (t.segments && t.segments.length > 0) {
            return `${typeStr}: ${t.segments[0].departureDate}`;
          }
          return typeStr;
        }
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
    <div className="accordion-content">
      {/* Header */}
      <div className="subsection-header catalog-groups-header" style={{ marginBottom: '12px' }}>
        <h4 className="subsection-title catalog-groups-label">Trip Expenses</h4>
        <div className="subsection-actions catalog-groups-right">
          {trip.canEdit !== false && (
            <button
              className="mini-icon-btn catalog-add-group-btn"
              onClick={onAddExpenseGroup}
              data-tooltip="Add Expense Group"
              data-tooltip-position="bottom"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

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
                <div className="place-group-header">
                  <span className="place-group-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getExpenseGroupIcon(group.icon, 14, '', { color: gColor })}
                    <span className="catalog-group-name" style={{ fontWeight: 600 }} title={group.name}>
                      {group.name}
                    </span>
                  </span>
                  <div className="flex-align flex-align--gap4">
                    {trip.canEdit !== false && (
                      <button
                        className="mini-icon-btn catalog-group-action-btn"
                        onClick={() => onAddExpense(group.id)}
                        data-tooltip={`Add Expense to ${group.name}`}
                      >
                        <Plus size={12} />
                      </button>
                    )}
                    {trip.canEdit !== false && (
                      <div className="group-dropdown-container" style={{ position: 'relative' }}>
                        <button
                          className="mini-icon-btn catalog-group-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveGroupDropdownId(activeGroupDropdownId === group.id ? null : group.id);
                          }}
                          data-tooltip="Group Options"
                        >
                          <MoreVertical size={12} />
                        </button>
                        {activeGroupDropdownId === group.id && (
                          <div className={`dropdown-menu dropdown-menu--right${showAbove ? ' dropdown-menu-above' : ''}`} style={{ zIndex: 1100 }}>
                            <button
                              className="dropdown-item"
                              disabled={isFirst}
                              onClick={(e) => {
                                e.stopPropagation();
                                onMoveExpenseGroup(groupIdx, 'up');
                                setActiveGroupDropdownId(null);
                              }}
                            >
                              <ChevronUp size={12} /> Move Up
                            </button>
                            <button
                              className="dropdown-item"
                              disabled={isLast}
                              onClick={(e) => {
                                e.stopPropagation();
                                onMoveExpenseGroup(groupIdx, 'down');
                                setActiveGroupDropdownId(null);
                              }}
                            >
                              <ChevronDown size={12} /> Move Down
                            </button>
                            <button
                              className="dropdown-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditExpenseGroup(group);
                                setActiveGroupDropdownId(null);
                              }}
                            >
                              <Edit2 size={12} /> Edit Group
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Group Items */}
                <div className="catalog-places-list">
                  {itemsInGroup.length > 0 ? (
                    itemsInGroup.map(item => {
                      const briefDetails = getBriefDetails(item);
                      const isLinked = !!item.linkedReservationId;
                      const unpaid = (item.lineItems || []).filter(l => !l.paid).length;
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

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                            {!isLinked && (() => {
                              const expenseDay = item.date ? activePlan.days[item.date] : undefined;
                              const location = expenseDay?.locationId ? trip.locations.find(l => l.id === expenseDay.locationId) : undefined;
                              if (!location) return null;
                              const tagColor = location.color || 'var(--accent-primary)';
                              const hexColor = location.color || '#6366f1';
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
                                    gap: '3px'
                                  }}
                                >
                                  <span style={{ fontSize: '10px', lineHeight: 1 }}>{getLocIcon(location)}</span>
                                  <span>{getFormattedLocationName(location, trip.locations)}</span>
                                </span>
                              );
                            })()}
                            {item.date && (
                              <span className="catalog-day-tag" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                {item.date}
                              </span>
                            )}
                            {isLinked && (() => {
                               const isHotel = item.linkedReservationType === 'hotel';
                               const tagColor = isHotel ? '#10b981' : '#f59e0b';
                               const tagBg = isHotel ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)';
                               const tagBorder = isHotel ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)';
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
                                     gap: '3px'
                                   }}
                                 >
                                   <Link size={8} />
                                   <span>{isHotel ? 'Hotel' : 'Transit'}</span>
                                 </span>
                               );
                             })()}
                            {briefDetails && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {briefDetails}
                              </span>
                            )}
                            {unpaid > 0 && (
                              <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 500, marginLeft: 'auto' }}>
                                {unpaid} unpaid
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>
                      No expenses in this group.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
  );
}
