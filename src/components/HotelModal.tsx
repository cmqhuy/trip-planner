import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Hotel } from '../types';

interface HotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripStartDate: string;
  tripEndDate: string;
  onSave: (hotelData: Omit<Hotel, 'id'>) => void;
}

export default function HotelModal({
  isOpen,
  onClose,
  tripStartDate,
  tripEndDate,
  onSave
}: HotelModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setAddress('');
      setCheckInDate(tripStartDate);
      setCheckOutDate(tripStartDate);
      setNotes('');
    }
  }, [isOpen, tripStartDate]);

  const handleCheckInChange = (val: string) => {
    setCheckInDate(val);
    if (checkOutDate < val) {
      setCheckOutDate(val);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !checkInDate || !checkOutDate) return;

    onSave({
      name: name.trim(),
      address: address.trim() || undefined,
      checkInDate,
      checkOutDate,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Hotel Stay Planner</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="hotel-name">Hotel Name</label>
            <input 
              type="text" 
              id="hotel-name"
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Hilton Roma" 
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="hotel-address">Address (Optional)</label>
            <input 
              type="text" 
              id="hotel-address"
              value={address} 
              onChange={e => setAddress(e.target.value)} 
              placeholder="e.g. Via Alberto, Rome" 
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="hotel-checkin">Check-In Date</label>
              <input 
                type="date" 
                id="hotel-checkin"
                value={checkInDate} 
                onChange={e => handleCheckInChange(e.target.value)} 
                min={tripStartDate} 
                max={tripEndDate} 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="hotel-checkout">Check-Out Date</label>
              <input 
                type="date" 
                id="hotel-checkout"
                value={checkOutDate} 
                onChange={e => setCheckOutDate(e.target.value)} 
                min={checkInDate || tripStartDate} 
                max={tripEndDate} 
                required 
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="hotel-notes">Notes (Optional)</label>
            <textarea 
              id="hotel-notes"
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Booking reference, room details..." 
              rows={2} 
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Stay</button>
          </div>
        </form>
      </div>
    </div>
  );
}
