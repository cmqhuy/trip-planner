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
  title?: string;
  message?: string;
  style?: React.CSSProperties;
}

export default function FunGeneratingLoader({ title, message, style }: FunGeneratingLoaderProps) {
  const [clauseIndex, setClauseIndex] = useState(() => Math.floor(Math.random() * FUN_CLAUSES.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setClauseIndex(prev => (prev + 1) % FUN_CLAUSES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  if (title) {
    return (
      <div className="ai-generate-loading-container" style={style}>
        <RefreshCw size={36} className="spin text-accent" />
        <h4 className="fun-loader-h4">{title}</h4>
        <p className="fun-loader-p">
          {message || 'Generating travel intelligence...'}
        </p>
        <span className="fun-loader-clause">
          {FUN_CLAUSES[clauseIndex]}
        </span>
      </div>
    );
  }

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
      <div className="fun-loader-spinner">
        <RefreshCw
          size={18}
          className="spin fun-loader-spin-icon"
        />
      </div>

      <div className="fun-loader-text-group">
        <span className="fun-loader-message">
          {message || 'Generating travel intelligence...'}
        </span>
        <span className="fun-clause-text">
          {FUN_CLAUSES[clauseIndex]}
        </span>
      </div>
    </div>
  );
}
