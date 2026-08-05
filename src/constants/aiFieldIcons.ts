import type { LucideIcon } from 'lucide-react';
import {
  Sparkles, AlertCircle,
  Calendar, CalendarCheck, Ticket, Compass, HelpCircle, MapPin, Info, Smile, Camera, Utensils,
  ShoppingBag, Coffee, DollarSign, BookOpen, Clock, Baby,
  Sparkle, Wand2, Brain, Bot, Activity, TrendingUp, Flame, Gem, Sun, Heart, Globe, Languages, Map
} from 'lucide-react';

/**
 * Icon name → Lucide component, for the icon a user picks per AI field.
 *
 * Lives outside the modal that renders the picker so that Fast Refresh keeps
 * working: a module exporting both components and constants loses it.
 */
export const FIELD_ICONS_MAP: { [key: string]: LucideIcon } = {
  Sparkles,
  Sparkle,
  Wand2,
  Brain,
  Bot,
  Calendar,
  CalendarCheck,
  Ticket,
  Compass,
  AlertCircle,
  HelpCircle,
  MapPin,
  Info,
  Smile,
  Camera,
  Utensils,
  ShoppingBag,
  Coffee,
  DollarSign,
  BookOpen,
  Clock,
  Baby,
  Activity,
  TrendingUp,
  Flame,
  Gem,
  Sun,
  Heart,
  Globe,
  Languages,
  Map
};

export const getIconColor = (iconName: string) => {
  switch (iconName) {
    case 'Sparkles': return '#a5b4fc'; // Indigo
    case 'Sparkle': return '#c084fc'; // Purple
    case 'Wand2': return '#e9d5ff'; // Light purple
    case 'Brain': return '#f472b6'; // Pink
    case 'Bot': return '#60a5fa'; // Blue
    case 'Calendar': return '#fda4af'; // Rose
    case 'Ticket': return '#6ee7b7'; // Emerald
    case 'Compass': return '#93c5fd'; // Sky blue
    case 'AlertCircle': return '#fde047'; // Yellow
    case 'HelpCircle': return '#c084fc'; // Purple
    case 'MapPin': return '#f87171'; // Red
    case 'Info': return '#38bdf8'; // Light blue
    case 'Smile': return '#facc15'; // Yellow-green
    case 'Camera': return '#ec4899'; // Pink
    case 'Utensils': return '#fb923c'; // Orange
    case 'ShoppingBag': return '#a7f3d0'; // Light emerald
    case 'Coffee': return '#b45309'; // Brown/Amber
    case 'DollarSign': return '#34d399'; // Green
    case 'BookOpen': return '#818cf8'; // Violet
    case 'Clock': return '#a3a3a3'; // Gray
    case 'Baby': return '#fbcfe8'; // Pastel Pink
    case 'Activity': return '#fb7185'; // Rose
    case 'TrendingUp': return '#34d399'; // Green
    case 'Flame': return '#f97316'; // Orange
    case 'Gem': return '#38bdf8'; // Cyan
    case 'Sun': return '#f59e0b'; // Amber
    case 'Heart': return '#ec4899'; // Pink
    case 'Globe': return '#60a5fa'; // Blue
    case 'Languages': return '#818cf8'; // Indigo
    case 'Map': return '#10b981'; // Green
    default: return '#c084fc';
  }
};

/** Formats an `aiUpdatedAt` timestamp for the "Updated: …" freshness label. */
export const formatFreshness = (timestamp?: number) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
