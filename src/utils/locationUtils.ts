import type { Location } from '../types';

export const getHotelResolvedLocation = (
  hotel: { checkInDate: string },
  days: Record<string, { locationId?: string }>,
  locations: Location[]
): Location | undefined => {
  const locId = days[hotel.checkInDate]?.locationId;
  return locId ? locations.find(l => l.id === locId) : undefined;
};

export interface ResolvedTransitLocations {
  departureLocation?: Location;
  arrivalLocation?: Location;
}

export const getTransitResolvedLocations = (
  departureDate: string,
  arrivalDate: string,
  days: Record<string, { locationId?: string }>,
  locations: Location[]
): ResolvedTransitLocations => {
  const depLocId = days[departureDate]?.locationId;
  const arrLocId = days[arrivalDate]?.locationId;
  const departureLocation = depLocId ? locations.find(l => l.id === depLocId) : undefined;
  const arrivalLocation = arrLocId ? locations.find(l => l.id === arrLocId) : undefined;
  return { departureLocation, arrivalLocation };
};
