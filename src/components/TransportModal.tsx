import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Transportation } from '../types';

interface TransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripStartDate: string;
  tripEndDate: string;
  onSave: (transportData: Omit<Transportation, 'id'>) => void;
}

export default function TransportModal({
  isOpen,
  onClose,
  tripStartDate,
  tripEndDate,
  onSave
}: TransportModalProps) {
  const [type, setType] = useState<Transportation['type']>('flight');
  const [depLoc, setDepLoc] = useState('');
  const [arrLoc, setArrLoc] = useState('');
  const [depDate, setDepDate] = useState('');
  const [arrDate, setArrDate] = useState('');
  const [depTime, setDepTime] = useState('');
  const [arrTime, setArrTime] = useState('');
  const [depTz, setDepTz] = useState('GMT+1');
  const [arrTz, setArrTz] = useState('GMT+1');
  const [carrier, setCarrier] = useState('');
  const [transitCode, setTransitCode] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setType('flight');
      setDepLoc('');
      setArrLoc('');
      setDepDate(tripStartDate);
      setArrDate(tripStartDate);
      setDepTime('12:00');
      setArrTime('14:00');
      setDepTz('GMT+1');
      setArrTz('GMT+1');
      setCarrier('');
      setTransitCode('');
      setNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Sync arrival date when departure date changes to ensure it's not before departure
  const handleDepDateChange = (val: string) => {
    setDepDate(val);
    if (arrDate < val) {
      setArrDate(val);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depLoc.trim() || !arrLoc.trim() || !depDate || !arrDate || !depTime || !arrTime || !depTz || !arrTz) return;

    onSave({
      type,
      departureLocationName: depLoc.trim(),
      arrivalLocationName: arrLoc.trim(),
      departureDate: depDate,
      departureTime: depTime,
      departureTimezone: depTz.trim(),
      arrivalDate: arrDate,
      arrivalTime: arrTime,
      arrivalTimezone: arrTz.trim(),
      carrier: carrier.trim() || undefined,
      transitCode: transitCode.trim() || undefined,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel scrollable" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Schedule Transportation</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-scroll-body">
            <div className="form-group">
              <label htmlFor="transport-type">Type</label>
              <select 
                id="transport-type"
                value={type} 
                onChange={e => setType(e.target.value as any)}
              >
                <option value="flight">✈️ Flight</option>
                <option value="train">🚆 Train</option>
                <option value="bus">🚌 Bus</option>
                <option value="car">🚗 Car Rental / Drive</option>
                <option value="ferry">🛳️ Ferry</option>
                <option value="other">🗺️ Other</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dep-loc">Departure Location</label>
                <input 
                  type="text" 
                  id="dep-loc"
                  value={depLoc} 
                  onChange={e => setDepLoc(e.target.value)} 
                  placeholder="e.g. Paris CDG Airport" 
                  required 
                />
              </div>
              <div className="form-group">
                <label htmlFor="arr-loc">Arrival Location</label>
                <input 
                  type="text" 
                  id="arr-loc"
                  value={arrLoc} 
                  onChange={e => setArrLoc(e.target.value)} 
                  placeholder="e.g. Rome FCO Airport" 
                  required 
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dep-date">Departure Date</label>
                <input 
                  type="date" 
                  id="dep-date"
                  value={depDate} 
                  onChange={e => handleDepDateChange(e.target.value)} 
                  min={tripStartDate} 
                  max={tripEndDate} 
                  required 
                />
              </div>
              <div className="form-group">
                <label htmlFor="arr-date">Arrival Date</label>
                <input 
                  type="date" 
                  id="arr-date"
                  value={arrDate} 
                  onChange={e => setArrDate(e.target.value)} 
                  min={depDate || tripStartDate} 
                  max={tripEndDate} 
                  required 
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dep-time">Departure Time</label>
                <input 
                  type="time" 
                  id="dep-time"
                  value={depTime} 
                  onChange={e => setDepTime(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label htmlFor="arr-time">Arrival Time</label>
                <input 
                  type="time" 
                  id="arr-time"
                  value={arrTime} 
                  onChange={e => setArrTime(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dep-tz">Departure Timezone</label>
                <input 
                  type="text" 
                  id="dep-tz"
                  value={depTz} 
                  onChange={e => setDepTz(e.target.value)} 
                  placeholder="e.g. GMT+1, CET" 
                  required 
                />
              </div>
              <div className="form-group">
                <label htmlFor="arr-tz">Arrival Timezone</label>
                <input 
                  type="text" 
                  id="arr-tz"
                  value={arrTz} 
                  onChange={e => setArrTz(e.target.value)} 
                  placeholder="e.g. GMT+9, JST" 
                  required 
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="transit-carrier">Carrier / Operator (Optional)</label>
                <input 
                  type="text" 
                  id="transit-carrier"
                  value={carrier} 
                  onChange={e => setCarrier(e.target.value)} 
                  placeholder="e.g. Air France" 
                />
              </div>
              <div className="form-group">
                <label htmlFor="transit-code">Transit Code / Flight No (Optional)</label>
                <input 
                  type="text" 
                  id="transit-code"
                  value={transitCode} 
                  onChange={e => setTransitCode(e.target.value)} 
                  placeholder="e.g. AF1234" 
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="transit-notes">Notes (Optional)</label>
              <textarea 
                id="transit-notes"
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Gate, booking reference, details..." 
                rows={2} 
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add Transport</button>
          </div>
        </form>
      </div>
    </div>
  );
}
