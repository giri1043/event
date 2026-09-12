export interface EventItem {
  id: string;
  slug: string;
  title: string;
  hostNames: string;
  celebrationType: string;
  date: string;
  time: string;
  venueName: string;
  venueAddress: string;
  googleMapsUrl?: string;
  invitationMessage: string;
  imageUrl?: string;
  imageSource?: 'upload' | 'url';
  imagePosition?: 'top' | 'center' | 'bottom';
  imageAspect?: 'auto' | 'portrait' | 'landscape' | 'square';
  imageFit?: 'cover' | 'contain' | 'natural';
  rsvpDeadline?: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: {
    totalInvitees: number;
    attendingCount: number;
    declinedCount: number;
    pendingCount: number;
    totalHeadcount: number;
  };
}

export interface GuestItem {
  id: string;
  eventId: string;
  guestCode: string;
  name: string;
  mobileNumber?: string;
  maxGuests: number;
  status: 'pending' | 'attending' | 'declined';
  attendingCount: number;
  notes?: string;
  dietaryPreferences?: string;
  updatedAt?: string;
}

export interface PublicInviteData {
  event: EventItem;
  guest: GuestItem | null;
}
