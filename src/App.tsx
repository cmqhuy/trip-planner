import { useState, useEffect } from 'react';
import type { Trip, Plan, PlanDay } from './types';
import TripDashboard from './components/TripDashboard';
import TripPlanner from './components/TripPlanner';
import { Compass } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'vacation-itineraries';

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('trip');
  });

  // Load trips from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setTrips(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse trips from LocalStorage:', e);
      }
    }
  }, []);

  // Sync activeTripId with URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentTripParam = params.get('trip');
    
    if (activeTripId) {
      if (currentTripParam !== activeTripId) {
        params.set('trip', activeTripId);
        params.delete('plan');
        params.delete('day');
        const newSearch = params.toString();
        window.history.pushState({}, '', `${window.location.pathname}?${newSearch}`);
      }
    } else {
      if (currentTripParam !== null) {
        params.delete('trip');
        params.delete('plan');
        params.delete('day');
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
        window.history.pushState({}, '', newUrl);
      }
    }
  }, [activeTripId]);

  // Listen to browser Back/Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTripId(params.get('trip'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Save trips to LocalStorage
  const saveTrips = (updatedTrips: Trip[]) => {
    setTrips(updatedTrips);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTrips));
  };

  // Helper to generate ISO dates within a range (inclusive)
  const generateDatesRange = (startStr: string, endStr: string): string[] => {
    const dates: string[] = [];
    const current = new Date(startStr);
    const end = new Date(endStr);
    
    // Safety limit to avoid infinite loops if bad dates are input
    let count = 0;
    while (current <= end && count < 100) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }
    return dates;
  };

  const handleCreateTrip = (newTripData: Omit<Trip, 'id' | 'locations' | 'plans'>) => {
    const tripId = `trip-${Date.now()}`;
    const dates = generateDatesRange(newTripData.startDate, newTripData.endDate);
    
    // Pre-scaffold Days map
    const defaultDays: { [dateStr: string]: PlanDay } = {};
    dates.forEach(date => {
      defaultDays[date] = {
        dateStr: date,
        placeIds: []
      };
    });

    // Create initial default plan
    const defaultPlan: Plan = {
      id: `plan-main-${Date.now()}`,
      name: 'Main Plan',
      startDate: newTripData.startDate,
      endDate: newTripData.endDate,
      days: defaultDays,
      hotels: [],
      transports: []
    };

    const newTrip: Trip = {
      id: tripId,
      name: newTripData.name,
      startDate: newTripData.startDate,
      endDate: newTripData.endDate,
      locations: [],
      plans: [defaultPlan]
    };

    saveTrips([...trips, newTrip]);
    setActiveTripId(tripId); // Open new trip immediately
  };

  const handleDeleteTrip = (id: string) => {
    const updated = trips.filter(t => t.id !== id);
    saveTrips(updated);
    if (activeTripId === id) {
      setActiveTripId(null);
    }
  };

  const handleUpdateTrip = (updatedTrip: Trip) => {
    const updated = trips.map(t => (t.id === updatedTrip.id ? updatedTrip : t));
    saveTrips(updated);
  };

  const activeTrip = trips.find(t => t.id === activeTripId);

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="app-header glass-panel" style={{ borderRadius: '0', borderWidth: '0 0 1px 0' }}>
        <div className="logo-section">
          <Compass size={24} style={{ color: 'var(--accent-primary)' }} />
          <h1>Trip Planner</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span 
            style={{ 
              fontSize: '11px', 
              color: 'var(--text-secondary)', 
              background: 'rgba(255,255,255,0.05)', 
              padding: '4px 10px', 
              borderRadius: '99px',
              border: '1px solid var(--border-glass)'
            }}
          >
            v1.0.0
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTrip ? (
          <TripPlanner 
            trip={activeTrip}
            onBack={() => setActiveTripId(null)}
            onUpdateTrip={handleUpdateTrip}
          />
        ) : (
          <TripDashboard 
            trips={trips}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            onSelectTrip={setActiveTripId}
          />
        )}
      </main>
    </div>
  );
}
