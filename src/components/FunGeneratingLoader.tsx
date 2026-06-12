import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const FUN_CLAUSES = [
  "Consulting local gelato experts...",
  "Packing virtual suitcases...",
  "Translating espresso orders...",
  "Mapping out traffic bypasses...",
  "Finding the sunniest cafe spots...",
  "Avoiding tourist traps...",
  "Locating the best photo spots...",
  "Checking historical fun facts...",
  "Polishing the travel itinerary...",
  "Double-checking passport expirations...",
  "Calculating walking shortcuts...",
  "Steering clear of pigeon swarms...",
  "Finding hidden alleys...",
  "Checking local subway schedules...",
  "Consulting neighborhood maps...",
  "Securing imaginary restaurant reservations..."
];

interface FunGeneratingLoaderProps {
  message?: string;
  style?: React.CSSProperties;
}

export default function FunGeneratingLoader({ message, style }: FunGeneratingLoaderProps) {
  const [clauseIndex, setClauseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setClauseIndex(prev => (prev + 1) % FUN_CLAUSES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div 
      style={{ 
        padding: '20px 10px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '12px', 
        textAlign: 'center',
        textTransform: 'none',
        ...style 
      }}
    >
      <div 
        style={{ 
          position: 'relative', 
          width: '18px', 
          height: '18px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
      >
        <RefreshCw 
          size={18} 
          className="spin" 
          style={{ 
            color: 'var(--accent-primary)',
            opacity: 0.9
          }} 
        />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span 
          style={{ 
            fontSize: '12.5px', 
            fontWeight: 600, 
            color: 'var(--text-primary)' 
          }}
        >
          {message || 'Generating travel intelligence...'}
        </span>
        <span 
          className="fun-clause-text" 
          style={{ 
            fontSize: '11px', 
            color: 'var(--text-muted)', 
            fontStyle: 'italic', 
            minHeight: '16px',
            transition: 'all 0.3s ease'
          }}
        >
          {FUN_CLAUSES[clauseIndex]}
        </span>
      </div>
    </div>
  );
}
