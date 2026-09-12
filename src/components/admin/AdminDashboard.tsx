import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Share2,
  Download,
  Upload,
  Search,
  ExternalLink,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  Calendar,
  MapPin,
  Sparkles,
  ChevronDown,
  UserCheck,
  KeyRound,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import { EventItem, GuestItem } from '../../types';
import { EventModal } from './EventModal';
import { GuestModal } from './GuestModal';
import { ShareModal } from './ShareModal';
import { ChangeCredentialsModal } from './ChangeCredentialsModal';
import { exportGuestsToCSV, parseCSVToGuests } from '../../utils/csv';

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, onLogout }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [currentEventId, setCurrentEventId] = useState<string>('');
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [metrics, setMetrics] = useState({
    totalInvitees: 0,
    attendingCount: 0,
    declinedCount: 0,
    pendingCount: 0,
    totalHeadcount: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<EventItem | null>(null);

  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestToEdit, setGuestToEdit] = useState<GuestItem | null>(null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareGuest, setShareGuest] = useState<GuestItem | null>(null);

  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);

  // In-app Delete Confirmation Dialog state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'guest' | 'event';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // In-app Toast Banner state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Guest list filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'attending' | 'declined' | 'pending'>('all');

  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // Load events
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      const data = await res.json();
      setEvents(data.events || []);
      if (data.events && data.events.length > 0) {
        if (!currentEventId || !data.events.some((e: EventItem) => e.id === currentEventId)) {
          setCurrentEventId(data.events[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching events');
    } finally {
      setLoading(false);
    }
  };

  // Load guests for selected event
  const fetchGuests = async (eventId: string) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/guests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      const data = await res.json();
      setGuests(data.guests || []);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err: any) {
      console.error('Error fetching guests', err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token]);

  useEffect(() => {
    if (currentEventId) {
      fetchGuests(currentEventId);
    } else {
      setGuests([]);
    }
  }, [currentEventId]);

  const currentEvent = events.find((e) => e.id === currentEventId);

  // Request to delete a guest (opens custom in-app confirmation modal)
  const requestDeleteGuest = (guestId: string, guestName?: string) => {
    const target = guests.find((g) => g.id === guestId);
    setDeleteTarget({
      type: 'guest',
      id: guestId,
      name: guestName || target?.name || 'Guest Record'
    });
  };

  // Request to delete an event (opens custom in-app confirmation modal)
  const requestDeleteEvent = (eventId: string, eventTitle?: string) => {
    const target = events.find((e) => e.id === eventId);
    setDeleteTarget({
      type: 'event',
      id: eventId,
      name: eventTitle || target?.title || 'Event'
    });
  };

  // Execute deletion when confirmed by user in the custom dialog
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    if (deleteTarget.type === 'guest') {
      try {
        const res = await fetch(`/api/events/${currentEventId}/guests/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setGuests((prev) => prev.filter((g) => g.id !== deleteTarget.id));
          fetchGuests(currentEventId);
          setToast({
            type: 'success',
            message: `Guest "${deleteTarget.name}" deleted successfully.`
          });
        } else {
          const data = await res.json().catch(() => ({}));
          setToast({
            type: 'error',
            message: data.error || 'Failed to delete guest.'
          });
        }
      } catch (err) {
        console.error('Failed to delete guest', err);
        setToast({
          type: 'error',
          message: 'Network error deleting guest record.'
        });
      } finally {
        setIsDeleting(false);
        setDeleteTarget(null);
      }
    } else if (deleteTarget.type === 'event') {
      try {
        const res = await fetch(`/api/events/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const remaining = events.filter((e) => e.id !== deleteTarget.id);
          setEvents(remaining);
          if (remaining.length > 0) {
            setCurrentEventId(remaining[0].id);
          } else {
            setCurrentEventId('');
          }
          setToast({
            type: 'success',
            message: `Event "${deleteTarget.name}" permanently deleted.`
          });
        } else {
          const data = await res.json().catch(() => ({}));
          setToast({
            type: 'error',
            message: data.error || 'Failed to delete event.'
          });
        }
      } catch (err) {
        console.error('Failed to delete event', err);
        setToast({
          type: 'error',
          message: 'Network error deleting event.'
        });
      } finally {
        setIsDeleting(false);
        setDeleteTarget(null);
      }
    }
  };

  // CSV Import handler
  const handleCSVImport = (file: File) => {
    if (!file || !currentEventId) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const parsed = parseCSVToGuests(text);
        if (parsed.length === 0) {
          setToast({
            type: 'error',
            message: 'No valid guest records found in the uploaded CSV.'
          });
          return;
        }

        const res = await fetch(`/api/events/${currentEventId}/guests/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ guests: parsed })
        });

        const data = await res.json();
        if (res.ok) {
          setToast({
            type: 'success',
            message: `Successfully imported ${data.count} guest records!`
          });
          fetchGuests(currentEventId);
        } else {
          setToast({
            type: 'error',
            message: data.error || 'Failed to import CSV'
          });
        }
      } catch (err) {
        setToast({
          type: 'error',
          message: 'Error processing CSV file.'
        });
      }
    };
    reader.readAsText(file);
  };

  // Filtered guests
  const filteredGuests = guests.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.guestCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.mobileNumber && g.mobileNumber.includes(searchQuery));

    const matchesStatus =
      statusFilter === 'all' ? true : g.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#2c241c] selection:bg-[#c49a45]/20 selection:text-[#5a421b]">
      {/* Top Navbar */}
      <header className="bg-[#fffdfa] border-b border-[#ded0be] sticky top-0 z-40 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#8e6c31] text-white flex items-center justify-center font-serif font-bold text-base shadow-xs">
                ✦
              </div>
              <span className="font-serif text-lg font-semibold tracking-wide text-[#2b221a]">
                Event Atelier
              </span>
            </div>

            {/* Event Selector dropdown */}
            {events.length > 0 && (
              <div className="relative">
                <select
                  value={currentEventId}
                  onChange={(e) => setCurrentEventId(e.target.value)}
                  className="pl-3 pr-8 py-1.5 rounded-xl bg-[#f5ede2] border border-[#d8cbb8] text-xs font-medium text-[#4a3928] focus:outline-hidden focus:ring-1 focus:ring-[#8e6c31] cursor-pointer appearance-none"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.date})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#735e49] absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                setEventToEdit(null);
                setIsEventModalOpen(true);
              }}
              className="py-1.5 px-3 rounded-xl bg-[#8e6c31] hover:bg-[#785924] text-white text-xs font-semibold tracking-wide flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Event</span>
            </button>

            {currentEvent && (
              <a
                href={`/${currentEvent.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-3 rounded-xl bg-[#f2ebd9] hover:bg-[#e6dcc6] text-[#544331] text-xs font-medium tracking-wide flex items-center gap-1.5 transition-colors border border-[#d9ccb6]"
              >
                <span>Preview Invite</span>
                <ExternalLink className="w-3 h-3 text-[#8e6c31]" />
              </a>
            )}

            <button
              type="button"
              onClick={() => setIsCredentialsModalOpen(true)}
              className="py-1.5 px-3 rounded-xl bg-[#f2ebd9] hover:bg-[#e6dcc6] text-[#544331] text-xs font-medium tracking-wide flex items-center gap-1.5 transition-colors border border-[#d9ccb6] cursor-pointer"
              title="Admin Security & Password"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#8e6c31]" />
              <span className="hidden sm:inline">Credentials</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-xl text-[#7c6954] hover:text-[#3d3023] hover:bg-[#ede5da] transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {loading ? (
          <div className="text-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#8e6c31] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="font-serif text-[#695642]">Loading event details...</p>
          </div>
        ) : !currentEvent ? (
          /* Empty State: Zero events */
          <div className="max-w-md mx-auto text-center py-20 px-6 bg-white rounded-3xl border border-[#ded0be] shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#f5ede2] text-[#8e6c31] flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl text-[#2b221a]">No Events Created Yet</h2>
            <p className="text-xs text-[#73604d] mt-2 mb-6 leading-relaxed">
              Create your first celebration invitation to start receiving personalized guest RSVPs.
            </p>
            <button
              type="button"
              onClick={() => {
                setEventToEdit(null);
                setIsEventModalOpen(true);
              }}
              className="py-3 px-6 rounded-xl bg-[#8e6c31] text-white text-xs font-semibold tracking-wide shadow-md shadow-[#8e6c31]/20 hover:bg-[#785924] transition-colors"
            >
              + Create Your First Event
            </button>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* EVENT HERO SUMMARY CARD */}
            {/* ========================================================================= */}
            <div className="bg-[#fffdfa] rounded-3xl border border-[#ded0be] shadow-sm p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {currentEvent.imageUrl ? (
                  <img
                    src={currentEvent.imageUrl}
                    alt={currentEvent.title}
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-[#ded0be] shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#f5ede2] border border-[#d9ccb6] flex items-center justify-center text-[#8e6c31] font-serif text-3xl shrink-0">
                    ✦
                  </div>
                )}

                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f4ece0] text-[#78634e] text-xs font-medium mb-2 border border-[#ded0be]">
                    <span>{currentEvent.celebrationType || 'Celebration'}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-[#8e6c31]">
                      /{currentEvent.slug}
                    </span>
                  </div>

                  <h1 className="font-serif text-2xl sm:text-3xl text-[#2b221a] font-normal leading-tight">
                    {currentEvent.title}
                  </h1>

                  <p className="text-sm text-[#544331] mt-1 font-medium">
                    {currentEvent.hostNames}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#786450] mt-3">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#8e6c31]" />
                      {currentEvent.date} {currentEvent.time && `• ${currentEvent.time}`}
                    </span>
                    {currentEvent.venueName && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#8e6c31]" />
                        {currentEvent.venueName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Event Level Quick Actions */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-[#ebdcc9]">
                <button
                  type="button"
                  onClick={() => {
                    setShareGuest(null);
                    setIsShareModalOpen(true);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-[#8e6c31] hover:bg-[#785924] text-white text-xs font-semibold tracking-wide flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Invite & QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEventToEdit(currentEvent);
                    setIsEventModalOpen(true);
                  }}
                  className="py-2.5 px-3.5 rounded-xl bg-[#f2ebd9] hover:bg-[#e6dcc6] text-[#4d3d2b] text-xs font-medium tracking-wide flex items-center gap-1.5 border border-[#d9ccb6] transition-colors cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-[#8e6c31]" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => requestDeleteEvent(currentEvent.id, currentEvent.title)}
                  className="p-2.5 rounded-xl bg-[#faf4ec] hover:bg-red-50 text-[#8e7456] hover:text-red-700 border border-[#e5d8c6] hover:border-red-200 transition-colors cursor-pointer"
                  title="Delete Event"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* LIVE RSVP METRICS CARDS */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {/* Total Invitees */}
              <div className="bg-[#fffdfa] p-4 sm:p-5 rounded-2xl border border-[#ded0be] shadow-2xs">
                <div className="flex items-center justify-between text-[#8c7762] mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Total Invitees
                  </span>
                  <Users className="w-4 h-4 text-[#8e6c31]" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl text-[#2b221a] font-normal">
                  {metrics.totalInvitees}
                </div>
                <p className="text-[11px] text-[#917f6c] mt-0.5">Guest records</p>
              </div>

              {/* Attending Count */}
              <div className="bg-[#fffdfa] p-4 sm:p-5 rounded-2xl border border-[#ded0be] shadow-2xs">
                <div className="flex items-center justify-between text-[#2e593c] mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Attending
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl text-emerald-900 font-normal">
                  {metrics.attendingCount}
                </div>
                <p className="text-[11px] text-[#63876e] mt-0.5">Confirmed parties</p>
              </div>

              {/* Declined Count */}
              <div className="bg-[#fffdfa] p-4 sm:p-5 rounded-2xl border border-[#ded0be] shadow-2xs">
                <div className="flex items-center justify-between text-[#6e5845] mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Declined
                  </span>
                  <XCircle className="w-4 h-4 text-neutral-500" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl text-[#3d3125] font-normal">
                  {metrics.declinedCount}
                </div>
                <p className="text-[11px] text-[#8e7a68] mt-0.5">Cannot attend</p>
              </div>

              {/* Pending Responses */}
              <div className="bg-[#fffdfa] p-4 sm:p-5 rounded-2xl border border-[#ded0be] shadow-2xs">
                <div className="flex items-center justify-between text-[#8a6829] mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Pending
                  </span>
                  <Clock className="w-4 h-4 text-[#8a6829]" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl text-[#5c4418] font-normal">
                  {metrics.pendingCount}
                </div>
                <p className="text-[11px] text-[#99815a] mt-0.5">Awaiting reply</p>
              </div>

              {/* Total Headcount */}
              <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-[#f6eee2] to-[#ede2d1] p-4 sm:p-5 rounded-2xl border border-[#dbcbb5] shadow-2xs">
                <div className="flex items-center justify-between text-[#695123] mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Total Headcount
                  </span>
                  <UserCheck className="w-4 h-4 text-[#8e6c31]" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl text-[#382b13] font-bold">
                  {metrics.totalHeadcount}
                </div>
                <p className="text-[11px] text-[#756243] mt-0.5">Seats & plates required</p>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* GUEST LIST & RSVP TRACKER */}
            {/* ========================================================================= */}
            <div className="bg-[#fffdfa] rounded-3xl border border-[#ded0be] shadow-sm overflow-hidden">
              {/* Table Controls Header */}
              <div className="p-5 sm:p-6 border-b border-[#ebdcc9] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl text-[#2b221a] font-normal">
                    Guest List & RSVP Tracker
                  </h2>
                  <p className="text-xs text-[#786450] mt-0.5">
                    Manage guest codes, contact details, notes, and attendance confirmations.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  {/* CSV Export */}
                  <button
                    type="button"
                    onClick={() => exportGuestsToCSV(guests, currentEvent.title)}
                    disabled={guests.length === 0}
                    className="py-2 px-3 rounded-xl bg-[#f2ebd9] hover:bg-[#e6dcc6] text-[#4d3d2b] text-xs font-medium tracking-wide flex items-center gap-1.5 border border-[#d9ccb6] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#8e6c31]" />
                    <span>Export CSV</span>
                  </button>

                  {/* CSV Import */}
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleCSVImport(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    className="py-2 px-3 rounded-xl bg-[#f2ebd9] hover:bg-[#e6dcc6] text-[#4d3d2b] text-xs font-medium tracking-wide flex items-center gap-1.5 border border-[#d9ccb6] transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#8e6c31]" />
                    <span>Import CSV</span>
                  </button>

                  {/* Add Guest Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setGuestToEdit(null);
                      setIsGuestModalOpen(true);
                    }}
                    className="py-2 px-4 rounded-xl bg-[#8e6c31] hover:bg-[#785924] text-white text-xs font-semibold tracking-wide flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Guest</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search Row */}
              <div className="p-4 sm:px-6 bg-[#faf6ef] border-b border-[#ebdcc9] flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, code, or phone..."
                    className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-white border border-[#d9ccb6] text-xs text-[#2b221a] focus:outline-hidden focus:ring-1 focus:ring-[#8e6c31]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#917e6b] absolute left-3 top-2.5" />
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1 bg-[#ede4d6] p-1 rounded-xl w-full sm:w-auto justify-center">
                  {(['all', 'attending', 'declined', 'pending'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                        statusFilter === st
                          ? 'bg-white text-[#2b221a] shadow-xs'
                          : 'text-[#6e5a46] hover:text-[#2b221a]'
                      }`}
                    >
                      {st === 'all' ? `All (${guests.length})` : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Guests Table */}
              {filteredGuests.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <p className="font-serif text-lg text-[#5a4837]">
                    {guests.length === 0
                      ? 'No guests registered yet'
                      : 'No guests match the search filter'}
                  </p>
                  <p className="text-xs text-[#8c7965] mt-1 max-w-sm mx-auto">
                    {guests.length === 0
                      ? 'Add individual guests with assigned invite codes, or import your guest list in bulk via CSV.'
                      : 'Try resetting your search query or switching status filters.'}
                  </p>
                  {guests.length === 0 && (
                    <div className="mt-5 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setGuestToEdit(null);
                          setIsGuestModalOpen(true);
                        }}
                        className="py-2.5 px-4 rounded-xl bg-[#8e6c31] text-white text-xs font-semibold hover:bg-[#785924] transition-colors"
                      >
                        + Add First Guest
                      </button>
                      <button
                        type="button"
                        onClick={() => csvInputRef.current?.click()}
                        className="py-2.5 px-4 rounded-xl bg-[#f2ebd9] text-[#4d3d2b] text-xs font-medium border border-[#d9ccb6] hover:bg-[#e6dcc6] transition-colors"
                      >
                        Import from CSV
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#3d3227]">
                    <thead className="bg-[#faf6ef] text-[#7a6754] uppercase tracking-wider text-[11px] font-semibold border-b border-[#ebdcc9]">
                      <tr>
                        <th className="py-3 px-4 sm:px-6">Guest / Party</th>
                        <th className="py-3 px-3">Guest Code</th>
                        <th className="py-3 px-3">RSVP Status</th>
                        <th className="py-3 px-3">Headcount</th>
                        <th className="py-3 px-3 hidden md:table-cell">Dietary & Notes</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebdcc9]">
                      {filteredGuests.map((guest) => (
                        <tr
                          key={guest.id}
                          className="hover:bg-[#fbf8f3] transition-colors"
                        >
                          {/* Name & Phone */}
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="font-semibold text-sm text-[#2b221a]">
                              {guest.name}
                            </div>
                            {guest.mobileNumber && (
                              <div className="text-[11px] text-[#85725f] mt-0.5">
                                {guest.mobileNumber}
                              </div>
                            )}
                          </td>

                          {/* Guest Code */}
                          <td className="py-3.5 px-3">
                            <span className="font-mono bg-[#f2ebd9] px-2 py-0.5 rounded text-[#59442b] text-[11px] border border-[#ded0be]">
                              {guest.guestCode}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                guest.status === 'attending'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : guest.status === 'declined'
                                  ? 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {guest.status === 'attending' && '✓ Attending'}
                              {guest.status === 'declined' && '✕ Declined'}
                              {guest.status === 'pending' && '⏳ Pending'}
                            </span>
                          </td>

                          {/* Headcount */}
                          <td className="py-3.5 px-3 font-medium text-[#2d251e]">
                            {guest.status === 'attending' ? (
                              <span>
                                {guest.attendingCount}{' '}
                                <span className="text-[#8e7b68] font-normal">
                                  / max {guest.maxGuests}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[#998774]">—</span>
                            )}
                          </td>

                          {/* Dietary & Notes */}
                          <td className="py-3.5 px-3 hidden md:table-cell max-w-xs truncate">
                            {guest.dietaryPreferences && (
                              <span className="inline-block bg-[#f3ede1] text-[#695540] text-[11px] px-2 py-0.5 rounded mr-1.5">
                                🍽️ {guest.dietaryPreferences}
                              </span>
                            )}
                            {guest.notes && (
                              <span className="text-[11px] text-[#7d6955] italic">
                                "{guest.notes}"
                              </span>
                            )}
                            {!guest.dietaryPreferences && !guest.notes && (
                              <span className="text-[#b5a695] text-[11px]">None</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Share Modal for this guest */}
                              <button
                                type="button"
                                onClick={() => {
                                  setShareGuest(guest);
                                  setIsShareModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-[#8e6c31] hover:bg-[#f2ebd9] transition-colors cursor-pointer"
                                title="Share personalized invite"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>

                              {/* Edit Guest */}
                              <button
                                type="button"
                                onClick={() => {
                                  setGuestToEdit(guest);
                                  setIsGuestModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-[#614e3b] hover:bg-[#f2ebd9] transition-colors cursor-pointer"
                                title="Edit guest"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* Delete Guest */}
                              <button
                                type="button"
                                onClick={() => requestDeleteGuest(guest.id, guest.name)}
                                className="p-1.5 rounded-lg text-[#8c745d] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete guest"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Event Edit / Create Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        eventToEdit={eventToEdit}
        onSave={() => {
          fetchEvents();
        }}
        onDelete={(eventId, title) => {
          requestDeleteEvent(eventId, title);
        }}
        token={token}
      />

      {/* Guest Edit / Create Modal */}
      {currentEvent && (
        <GuestModal
          isOpen={isGuestModalOpen}
          onClose={() => setIsGuestModalOpen(false)}
          eventId={currentEvent.id}
          guestToEdit={guestToEdit}
          onSave={() => {
            fetchGuests(currentEvent.id);
          }}
          onDelete={(guestId, name) => {
            requestDeleteGuest(guestId, name);
          }}
          token={token}
        />
      )}

      {/* Quick Share Modal */}
      {currentEvent && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          event={currentEvent}
          guests={guests}
          preselectedGuest={shareGuest}
        />
      )}

      {/* Change Admin Credentials Modal */}
      <ChangeCredentialsModal
        isOpen={isCredentialsModalOpen}
        onClose={() => setIsCredentialsModalOpen(false)}
        token={token}
      />

      {/* Custom In-App Delete Confirmation Modal (no browser alert/confirm blocks) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#fffefc] rounded-3xl border border-[#ebdcc9] shadow-2xl overflow-hidden p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-xl text-[#2b221a] font-normal">
                  {deleteTarget.type === 'guest' ? 'Delete Guest Record' : 'Delete Event Invitation'}
                </h3>
                <p className="text-xs text-[#735e49] mt-2 leading-relaxed">
                  {deleteTarget.type === 'guest' ? (
                    <>
                      Are you sure you want to remove{' '}
                      <strong className="text-[#2b221a] font-semibold">{deleteTarget.name}</strong> from this event? This will revoke their personalized invite code and clear their RSVP status.
                    </>
                  ) : (
                    <>
                      Are you sure you want to permanently delete{' '}
                      <strong className="text-[#2b221a] font-semibold">{deleteTarget.name}</strong>? All registered guest records and RSVP statuses will be deleted. This cannot be undone.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#ede2d4] flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="py-2.5 px-4 rounded-xl bg-[#ede4d6] hover:bg-[#e2d5c2] text-[#52412e] text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold tracking-wide shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteTarget.type === 'guest' ? 'Delete Guest' : 'Delete Event'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border bg-white border-[#ebdcc9] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <p className="text-xs font-medium text-[#2d241c] flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[#998774] hover:text-[#2d241c] p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
