import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Check,
  X,
  Sparkles,
  Heart,
  Users,
  Utensils,
  MessageSquare,
  ChevronDown,
  Lock,
  Shield,
  Maximize2
} from 'lucide-react';
import { EventItem, GuestItem } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { apiRequest } from '../../utils/api';

interface EnvelopeInvitationProps {
  event: EventItem;
  guest: GuestItem | null;
  onRsvpSuccess?: (updatedGuest: GuestItem) => void;
  onAdminAccess?: () => void;
}

export const EnvelopeInvitation: React.FC<EnvelopeInvitationProps> = ({
  event,
  guest: initialGuest,
  onRsvpSuccess,
  onAdminAccess
}) => {
  // Envelope state: 'sealed' -> 'unfolding' -> 'opened'
  const [envelopeState, setEnvelopeState] = useState<'sealed' | 'unfolding' | 'opened'>('sealed');
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // Guest & RSVP state
  const [guest, setGuest] = useState<GuestItem | null>(initialGuest);
  const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'declined' | null>(
    initialGuest?.status && initialGuest.status !== 'pending' ? initialGuest.status : null
  );
  const [attendingCount, setAttendingCount] = useState<number>(
    initialGuest?.attendingCount && initialGuest.attendingCount > 0
      ? initialGuest.attendingCount
      : 1
  );
  const [guestName, setGuestName] = useState(initialGuest?.name || '');
  const [mobileNumber, setMobileNumber] = useState(initialGuest?.mobileNumber || '');
  const [dietary, setDietary] = useState(initialGuest?.dietaryPreferences || '');
  const [notes, setNotes] = useState(initialGuest?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isEditingRsvp, setIsEditingRsvp] = useState(
    !initialGuest || initialGuest.status === 'pending'
  );

  // Max guests allowed for this guest record or default to 4 for general
  const maxAllowed = initialGuest?.maxGuests || 6;

  // Adaptive framing & aspect ratio handling
  const effectiveAspect = event.imageAspect || (isPortrait ? 'portrait' : 'auto');
  const effectivePosition = event.imagePosition || (isPortrait ? 'top' : 'top');
  const effectiveFit = event.imageFit || 'cover';

  const positionClass =
    effectivePosition === 'center'
      ? 'object-center'
      : effectivePosition === 'bottom'
      ? 'object-bottom'
      : 'object-top';

  let containerClass =
    'relative w-full aspect-[4/5] sm:aspect-[3/4] max-h-[580px] rounded-2xl overflow-hidden border border-[#d9ccba] shadow-sm bg-[#ede5da]';
  let imgClass = `relative z-10 w-full h-full object-cover ${positionClass}`;

  if (effectiveFit === 'contain') {
    containerClass =
      'relative w-full min-h-[300px] max-h-[580px] rounded-2xl overflow-hidden border border-[#d9ccba] shadow-sm bg-[#2d2217]/5 flex items-center justify-center p-2';
    imgClass = 'relative z-10 max-h-[560px] w-auto max-w-full object-contain rounded-xl';
  } else if (effectiveAspect === 'portrait') {
    containerClass =
      'relative w-full aspect-[4/5] sm:aspect-[3/4] max-h-[580px] rounded-2xl overflow-hidden border border-[#d9ccba] shadow-sm bg-[#ede5da]';
    imgClass = `relative z-10 w-full h-full object-cover ${positionClass}`;
  } else if (effectiveAspect === 'landscape') {
    containerClass =
      'relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden border border-[#d9ccba] shadow-sm bg-[#ede5da]';
    imgClass = `relative z-10 w-full h-full object-cover ${positionClass}`;
  } else if (effectiveAspect === 'square') {
    containerClass =
      'relative w-full aspect-square max-h-[500px] rounded-2xl overflow-hidden border border-[#d9ccba] shadow-sm bg-[#ede5da]';
    imgClass = `relative z-10 w-full h-full object-cover ${positionClass}`;
  } else {
    // auto: adapt to detected orientation
    containerClass = isPortrait
      ? 'relative w-full aspect-[4/5] sm:aspect-[3/4] max-h-[580px] rounded-2xl overflow-hidden border border-[#d9ccba] shadow-sm bg-[#ede5da]'
      : 'relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden border border-[#d9ccba] shadow-sm bg-[#ede5da]';
    imgClass = `relative z-10 w-full h-full object-cover ${positionClass}`;
  }

  // Unfolding animation trigger
  const handleOpenEnvelope = () => {
    if (envelopeState !== 'sealed') return;
    setEnvelopeState('unfolding');
    // After 2.2 seconds transition to opened
    setTimeout(() => {
      setEnvelopeState('opened');
    }, 2200);
  };

  const handleInstantOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEnvelopeState('opened');
  };

  // Format date nicely
  const formattedDate = (() => {
    try {
      if (!event.date) return '';
      const [y, m, d] = event.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return event.date;
    }
  })();

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsvpStatus) {
      setSubmitError('Please select whether you will attend or decline.');
      return;
    }
    if (!guest && !guestName.trim()) {
      setSubmitError('Please provide your name.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        slug: event.slug,
        guestCode: guest?.guestCode,
        name: guest ? guest.name : guestName.trim(),
        mobileNumber: guest ? guest.mobileNumber : mobileNumber.trim(),
        status: rsvpStatus,
        attendingCount: rsvpStatus === 'attending' ? attendingCount : 0,
        dietaryPreferences: dietary.trim(),
        notes: notes.trim()
      };

      const data = await apiRequest<{ guest?: GuestItem }>('/api/public/rsvp', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data.guest) {
        setGuest(data.guest);
        if (data.guest.guestCode) {
          const newPath = `/${event.slug}/${data.guest.guestCode}`;
          if (window.location.pathname !== newPath) {
            window.history.replaceState({}, '', newPath);
          }
        }
        if (onRsvpSuccess) onRsvpSuccess(data.guest);
      }

      setIsEditingRsvp(false);

      if (rsvpStatus === 'attending') {
        triggerConfetti();
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Error saving response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google Maps directions link
  const mapsUrl =
    event.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${event.venueName} ${event.venueAddress}`
    )}`;

  // Google Calendar Add Event link
  const makeCalendarUrl = () => {
    const text = encodeURIComponent(event.title || event.hostNames);
    const details = encodeURIComponent(
      `${event.invitationMessage}\n\nHosted by: ${event.hostNames}`
    );
    const location = encodeURIComponent(`${event.venueName}, ${event.venueAddress}`);
    // rough date conversion
    const cleanDate = event.date.replace(/-/g, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${cleanDate}T180000Z/${cleanDate}T220000Z&details=${details}&location=${location}`;
  };

  return (
    <div className="min-h-screen bg-[#f5f1eb] py-6 sm:py-12 px-3 sm:px-6 flex flex-col items-center justify-start relative overflow-x-hidden selection:bg-[#c49a45]/20 selection:text-[#5a421b]">
      {/* Subtle background ambient grain & botanical watermark */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#e3d7c7_1px,transparent_1px)] [background-size:16px_16px]"
        aria-hidden="true"
      />

      {/* Clear Administrator Access Entry Point */}
      <button
        type="button"
        id="btn-admin-access-corner"
        onClick={() => {
          if (onAdminAccess) {
            onAdminAccess();
          } else {
            window.location.href = '/admin';
          }
        }}
        className="fixed top-3.5 right-3.5 sm:top-4 sm:right-4 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fffdf9]/90 hover:bg-white text-[#735e49] hover:text-[#2b221a] text-xs font-medium border border-[#d8c7b4] shadow-xs backdrop-blur-xs transition-all cursor-pointer hover:shadow-sm"
        title="Restricted Administrator Access"
      >
        <Lock className="w-3.5 h-3.5 text-[#8e6c31]" />
        <span className="text-[11px] font-semibold tracking-wide">Admin Access</span>
      </button>

      <AnimatePresence mode="wait">
        {envelopeState !== 'opened' ? (
          /* ========================================================================= */
          /* 1. CLOSED / UNFOLDING ENVELOPE EXPERIENCE */
          /* ========================================================================= */
          <motion.div
            key="envelope-view"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -40 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg mx-auto flex flex-col items-center justify-center my-auto pt-6 pb-12 cursor-pointer perspective-1000"
            onClick={handleOpenEnvelope}
            id="interactive-envelope-container"
          >
            {/* Header / Guest greeting pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6 flex flex-col items-center text-center px-4"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ede5da] border border-[#d9cdbd] text-[#715f48] text-xs uppercase tracking-widest font-medium shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#b38b4d] animate-pulse" />
                <span>Special Invitation</span>
              </div>
              <h1 className="mt-3 font-serif text-2xl sm:text-3xl text-[#3d332a] font-normal tracking-wide">
                {guest?.name
                  ? `An Invitation For You — ${guest.name}`
                  : 'An Invitation For You'}
              </h1>
              <p className="text-xs text-[#8c7a65] mt-1 tracking-wider uppercase">
                {event.hostNames}
              </p>
            </motion.div>

            {/* The 3D Vintage Envelope Body */}
            <div className="relative w-full max-w-[390px] sm:max-w-[430px] aspect-[1.38/1] rounded-2xl bg-gradient-to-b from-[#fbf8f3] via-[#f5ede0] to-[#ecdcc8] shadow-[0_20px_50px_-15px_rgba(87,67,46,0.35),0_0_0_1px_rgba(209,191,168,0.6)] p-3 preserve-3d overflow-hidden border border-[#dfd0be]">
              {/* Envelope flap folds and paper lining */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fffcf7] via-transparent to-transparent opacity-70 pointer-events-none" />

              {/* Envelope inner decorative gold liner border */}
              <div className="w-full h-full rounded-xl border border-dashed border-[#c8b397] relative flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                {/* Envelope Corner filigree ornaments */}
                <div className="absolute top-2 left-2 text-[#cbb89f] text-xs select-none">✦</div>
                <div className="absolute top-2 right-2 text-[#cbb89f] text-xs select-none">✦</div>
                <div className="absolute bottom-2 left-2 text-[#cbb89f] text-xs select-none">✦</div>
                <div className="absolute bottom-2 right-2 text-[#cbb89f] text-xs select-none">✦</div>

                {/* Diagonal envelope fold lines */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <line x1="0" y1="100" x2="50" y2="45" stroke="#7a5d3b" strokeWidth="0.8" />
                    <line x1="100" y1="100" x2="50" y2="45" stroke="#7a5d3b" strokeWidth="0.8" />
                  </svg>
                </div>

                {/* Envelope Top Triangle Flap with 3D Flip animation */}
                <motion.div
                  className="absolute -top-1 inset-x-0 h-[52%] origin-top preserve-3d z-20"
                  animate={
                    envelopeState === 'unfolding'
                      ? {
                          rotateX: -180,
                          transition: { duration: 1.2, ease: [0.45, 0, 0.55, 1] }
                        }
                      : { rotateX: 0 }
                  }
                >
                  <div className="w-full h-full bg-gradient-to-b from-[#ebe1d1] to-[#ded0bc] shadow-md border-b border-[#c4b39b] [clip-path:polygon(0_0,100%_0,50%_100%)] flex items-end justify-center pb-2">
                    <div className="w-2 h-2 rounded-full bg-[#c8b399] opacity-40 mb-1" />
                  </div>
                </motion.div>

                {/* Peeking Letter inside envelope (slides up during unfold) */}
                <motion.div
                  className="absolute inset-x-6 top-8 bottom-6 bg-[#fffefb] rounded-lg shadow-inner border border-[#ebdcc8] p-4 flex flex-col items-center justify-center z-10"
                  animate={
                    envelopeState === 'unfolding'
                      ? {
                          y: -70,
                          scale: 1.05,
                          opacity: 1,
                          transition: { delay: 0.8, duration: 1.2, ease: 'easeOut' }
                        }
                      : { y: 0, opacity: 0.85 }
                  }
                >
                  <p className="font-serif text-lg text-[#5a4837] italic">
                    {event.celebrationType}
                  </p>
                  <p className="text-xs text-[#a08b73] tracking-widest uppercase mt-1">
                    {formattedDate}
                  </p>
                </motion.div>

                {/* Center Wax Seal Emblem with warm organic glow */}
                <motion.div
                  className="relative z-30 flex flex-col items-center mt-2"
                  animate={
                    envelopeState === 'unfolding'
                      ? {
                          scale: [1, 1.25, 0.3],
                          opacity: [1, 1, 0],
                          rotate: [0, -10, 20],
                          transition: { duration: 0.9, ease: 'easeInOut' }
                        }
                      : {
                          scale: [1, 1.02, 1],
                          transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' }
                        }
                  }
                >
                  {/* Wax Seal Outer Organic Rim */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#aa2e25] via-[#871d18] to-[#5e120e] shadow-[0_8px_20px_rgba(110,21,15,0.45),inset_0_2px_4px_rgba(255,160,150,0.5),inset_0_-3px_6px_rgba(0,0,0,0.45)] border-2 border-[#b8382f] flex items-center justify-center p-1 relative">
                    {/* Organic droplets on seal edges */}
                    <div className="absolute -top-1.5 left-5 w-4 h-3 rounded-full bg-[#871d18] shadow-xs opacity-90" />
                    <div className="absolute -bottom-1.5 right-4 w-5 h-4 rounded-full bg-[#6a1510] shadow-xs opacity-90" />
                    <div className="absolute top-4 -right-1 w-3 h-4 rounded-full bg-[#8e201b] shadow-xs opacity-90" />

                    {/* Inner seal stamp ring */}
                    <div className="w-14 h-14 rounded-full border border-dashed border-[#f4b8b4]/40 flex flex-col items-center justify-center shadow-inner">
                      <span className="font-serif font-bold text-xl text-[#ffdeda] tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {event.hostNames
                          .split('&')[0]
                          ?.trim()
                          ?.charAt(0) || 'E'}
                        ✦
                        {event.hostNames
                          .split('&')[1]
                          ?.trim()
                          ?.charAt(0) || 'M'}
                      </span>
                      <span className="text-[8px] text-[#fcd8d5] uppercase tracking-wider -mt-0.5">
                        SEALED
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Tap to Unseal prompt */}
                <div className="relative z-30 mt-4 text-[#7c6952] flex items-center gap-1.5 text-xs font-medium tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-[#b38b4d]" />
                  <span>
                    {envelopeState === 'unfolding'
                      ? 'Unfolding Invitation...'
                      : 'Tap to unseal & reveal invitation'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Skip Button for instant reveal */}
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={handleInstantOpen}
              className="mt-6 text-xs text-[#8f7e6b] hover:text-[#524436] underline underline-offset-4 tracking-wider transition-colors cursor-pointer py-1 px-3"
            >
              Open Immediately without animation
            </motion.button>
          </motion.div>
        ) : (
          /* ========================================================================= */
          /* 2. REVEALED INVITATION & INSTANT RSVP CARD */
          /* ========================================================================= */
          <motion.div
            key="invitation-card"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl mx-auto flex flex-col items-center"
            id="public-invitation-main"
          >
            {/* Main Invitation Card Container */}
            <div className="w-full bg-[#faf8f5] rounded-3xl shadow-[0_25px_60px_-15px_rgba(65,50,35,0.18),0_0_0_1px_rgba(215,199,178,0.6)] border border-[#ded0be] overflow-hidden relative">
              {/* Card Top Botanical Accent Header */}
              <div className="pt-8 pb-4 px-6 sm:px-10 flex flex-col items-center text-center">
                {/* Botanical Laurel Crest Emblem */}
                <div className="w-12 h-12 rounded-full bg-[#f1e9dd] border border-[#d9ccba] flex items-center justify-center text-[#9c783e] mb-4 shadow-xs">
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                </div>

                <span className="text-xs uppercase tracking-[0.25em] text-[#8e7b65] font-semibold">
                  {event.celebrationType || 'Formal Invitation'}
                </span>

                {/* Host / Couple Names */}
                <h1 className="font-serif text-3xl sm:text-5xl text-[#2d251e] tracking-tight font-normal mt-3 leading-tight">
                  {event.hostNames}
                </h1>

                {/* Decorative Gold Rule */}
                <div className="flex items-center justify-center gap-3 my-4 w-full max-w-[200px]">
                  <div className="h-[1px] bg-gradient-to-r from-transparent via-[#c49a45] to-transparent flex-1" />
                  <span className="text-[#b3883b] text-xs">✦</span>
                  <div className="h-[1px] bg-gradient-to-r from-transparent via-[#c49a45] to-transparent flex-1" />
                </div>

                {/* Celebration Title */}
                {event.title && (
                  <h2 className="font-serif text-xl sm:text-2xl text-[#534335] italic font-normal">
                    {event.title}
                  </h2>
                )}

                {/* Warm Invitation Message */}
                <div className="mt-5 max-w-md text-[#665646] text-sm sm:text-base leading-relaxed font-light px-2">
                  {event.invitationMessage}
                </div>
              </div>

              {/* Host-Uploaded Photo with smart adaptive framing & full view lightbox */}
              {event.imageUrl && (
                <div className="px-6 sm:px-10 py-3">
                  <div
                    className={`${containerClass} group cursor-pointer transition-transform duration-300 hover:shadow-md`}
                    onClick={() => setShowLightbox(true)}
                    title="Click to view full photo"
                  >
                    {/* Ambient subtle glow matching photo palette */}
                    <div
                      className="absolute inset-0 bg-cover bg-center blur-2xl opacity-35 scale-110 pointer-events-none"
                      style={{ backgroundImage: `url(${event.imageUrl})` }}
                    />

                    {!photoLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#ede5da] animate-pulse z-10">
                        <span className="text-xs text-[#998774] font-serif italic">
                          Loading photo portrait...
                        </span>
                      </div>
                    )}
                    <img
                      src={event.imageUrl}
                      alt={event.title || event.hostNames}
                      referrerPolicy="no-referrer"
                      onLoad={(e) => {
                        setPhotoLoaded(true);
                        const img = e.currentTarget;
                        if (img.naturalHeight && img.naturalWidth) {
                          setIsPortrait(img.naturalHeight > img.naturalWidth * 0.92);
                        }
                      }}
                      className={`${imgClass} transition-opacity duration-700 ${
                        photoLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                    />

                    {/* View Full Photo badge */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLightbox(true);
                      }}
                      className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1b140e]/75 hover:bg-[#1b140e]/90 text-white text-[11px] font-medium backdrop-blur-md transition-all shadow-md cursor-pointer group-hover:scale-105"
                      title="View full high-resolution photo"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-[#e6caa2]" />
                      <span>Full Photo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Event Metadata: Date, Time & Venue */}
              <div className="px-6 sm:px-10 py-6 border-t border-[#ece1d3] mt-4 bg-[#f8f5ef]/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-left">
                  {/* Date & Time Block */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#ede4d6] text-[#8c6f3d] flex items-center justify-center shrink-0 shadow-2xs border border-[#ddd0be]">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#8e7b65]">
                        Date & Time
                      </p>
                      <p className="text-sm sm:text-base font-serif font-medium text-[#2d251e] mt-0.5">
                        {formattedDate}
                      </p>
                      <p className="text-xs text-[#6e5d4d] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-[#9c783e]" />
                        <span>{event.time}</span>
                      </p>
                    </div>
                  </div>

                  {/* Venue & Location Block */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#ede4d6] text-[#8c6f3d] flex items-center justify-center shrink-0 shadow-2xs border border-[#ddd0be]">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#8e7b65]">
                        Celebration Venue
                      </p>
                      <p className="text-sm sm:text-base font-serif font-medium text-[#2d251e] mt-0.5">
                        {event.venueName}
                      </p>
                      <p className="text-xs text-[#6e5d4d] mt-0.5 leading-relaxed line-clamp-2">
                        {event.venueAddress}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Location & Calendar Action Buttons */}
                <div className="mt-5 pt-4 border-t border-[#ebdcc9] flex flex-wrap items-center justify-between gap-3">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ede4d6] hover:bg-[#e4d9c8] text-[#4d3d2c] text-xs font-semibold tracking-wide transition-all shadow-2xs border border-[#dacbb8]"
                    id="btn-view-location"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#9c783e]" />
                    <span>View Location on Google Maps</span>
                    <ExternalLink className="w-3 h-3 text-[#9c783e]" />
                  </a>

                  <a
                    href={makeCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-[#7d6852] hover:text-[#3d3124] transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Add to Calendar</span>
                  </a>
                </div>

                {event.rsvpDeadline && (
                  <p className="text-center text-xs text-[#8c7a65] mt-4 italic font-serif">
                    Kindly reply by {event.rsvpDeadline}
                  </p>
                )}
              </div>

              {/* ========================================================================= */}
              {/* 3. INSTANT RSVP FLOW */}
              {/* ========================================================================= */}
              <div className="p-6 sm:p-10 bg-[#f4eee4] border-t border-[#e5d8c6]" id="rsvp-section">
                <div className="text-center mb-6">
                  <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#8c7456]">
                    Response Form
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-[#2b221a] font-normal mt-1">
                    Will You Join Us?
                  </h3>
                  {guest?.name && (
                    <p className="text-xs text-[#6e5a45] mt-1">
                      Reserved for <strong className="text-[#3b2e21]">{guest.name}</strong>
                    </p>
                  )}
                </div>

                {/* Display Persistent Confirmation Summary Card if already submitted and not editing */}
                {!isEditingRsvp && guest?.status && guest.status !== 'pending' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#fffefc] rounded-2xl p-6 border border-[#dfd2c0] shadow-sm text-center"
                  >
                    <div
                      className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 ${
                        guest.status === 'attending'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
                      }`}
                    >
                      {guest.status === 'attending' ? (
                        <Check className="w-6 h-6 stroke-[2.5]" />
                      ) : (
                        <X className="w-6 h-6 stroke-[2.5]" />
                      )}
                    </div>

                    <h4 className="font-serif text-xl text-[#2b221a]">
                      {guest.status === 'attending'
                        ? 'Response Confirmed: Joyfully Attending!'
                        : 'Response Confirmed: Regretfully Declines'}
                    </h4>

                    {guest.status === 'attending' && (
                      <p className="text-sm text-[#665440] mt-1.5 font-medium">
                        {guest.attendingCount} {guest.attendingCount === 1 ? 'Guest' : 'Guests'} Reserved
                      </p>
                    )}

                    {guest.dietaryPreferences && (
                      <p className="text-xs text-[#7a6752] mt-2 italic">
                        Dietary note: "{guest.dietaryPreferences}"
                      </p>
                    )}
                    {guest.notes && (
                      <p className="text-xs text-[#7a6752] mt-1 italic">
                        Message to host: "{guest.notes}"
                      </p>
                    )}

                    <div className="mt-5 pt-4 border-t border-[#ede2d2] flex justify-center">
                      <button
                        type="button"
                        onClick={() => setIsEditingRsvp(true)}
                        className="text-xs font-semibold text-[#8c6f3d] hover:text-[#5c4724] underline underline-offset-4 tracking-wide cursor-pointer py-1 px-3"
                        id="btn-edit-rsvp"
                      >
                        Change or Update Your Response
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* Interactive RSVP Submission Form */
                  <form onSubmit={handleRsvpSubmit} className="space-y-5">
                    {/* Error banner */}
                    {submitError && (
                      <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center">
                        {submitError}
                      </div>
                    )}

                    {/* Guest Name & Mobile (for general public links without personalized guestCode) */}
                    {!guest && (
                      <div className="space-y-3 bg-[#fcfbfa] p-4 rounded-2xl border border-[#ded0be]">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6b5844] mb-1">
                            Your Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="e.g. Eleanor Parker"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6c7b5] text-sm text-[#2e261f] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6b5844] mb-1">
                            Mobile Number (Optional)
                          </label>
                          <input
                            type="tel"
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            placeholder="e.g. +1 555-0199"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6c7b5] text-sm text-[#2e261f] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Touch-Friendly RSVP Choice Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        id="btn-rsvp-attending"
                        onClick={() => {
                          setRsvpStatus('attending');
                          setSubmitError(null);
                        }}
                        className={`py-3.5 px-4 rounded-2xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                          rsvpStatus === 'attending'
                            ? 'bg-[#295135] text-white border-[#295135] shadow-md shadow-[#295135]/20 scale-[1.01]'
                            : 'bg-white hover:bg-[#fbf9f6] text-[#334637] border-[#c7dacb]'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>✓ Will Attend</span>
                      </button>

                      <button
                        type="button"
                        id="btn-rsvp-declined"
                        onClick={() => {
                          setRsvpStatus('declined');
                          setSubmitError(null);
                        }}
                        className={`py-3.5 px-4 rounded-2xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                          rsvpStatus === 'declined'
                            ? 'bg-[#5c5044] text-white border-[#5c5044] shadow-md shadow-[#5c5044]/20 scale-[1.01]'
                            : 'bg-white hover:bg-[#fbf9f6] text-[#695b4e] border-[#d8cdbf]'
                        }`}
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                        <span>✕ Will Not Attend</span>
                      </button>
                    </div>

                    {/* Conditional Attending Fields: Guest count (+) and (-) controls */}
                    <AnimatePresence>
                      {rsvpStatus === 'attending' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4 pt-2 overflow-hidden"
                        >
                          {/* Attending Count Selector with (+) and (-) */}
                          <div className="bg-white p-4 rounded-2xl border border-[#ded0be] flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Users className="w-5 h-5 text-[#9c783e]" />
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-[#695845]">
                                  Number of Guests Attending
                                </p>
                                <p className="text-xs text-[#8c7965]">
                                  {maxAllowed ? `Allocated party up to ${maxAllowed}` : 'Including yourself'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                id="btn-guest-decrease"
                                onClick={() => setAttendingCount((prev) => Math.max(1, prev - 1))}
                                disabled={attendingCount <= 1}
                                className="w-9 h-9 rounded-xl bg-[#f5ede2] text-[#4d3d2c] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ede2d2] flex items-center justify-center font-bold text-lg cursor-pointer transition-colors border border-[#d9ccbc]"
                              >
                                −
                              </button>
                              <span className="w-7 text-center font-serif text-xl font-bold text-[#2d251e]">
                                {attendingCount}
                              </span>
                              <button
                                type="button"
                                id="btn-guest-increase"
                                onClick={() =>
                                  setAttendingCount((prev) => Math.min(maxAllowed, prev + 1))
                                }
                                disabled={attendingCount >= maxAllowed}
                                className="w-9 h-9 rounded-xl bg-[#f5ede2] text-[#4d3d2c] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ede2d2] flex items-center justify-center font-bold text-lg cursor-pointer transition-colors border border-[#d9ccbc]"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Dietary Requirements */}
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6b5844] mb-1">
                              Dietary Preferences & Allergies
                            </label>
                            <input
                              type="text"
                              value={dietary}
                              onChange={(e) => setDietary(e.target.value)}
                              placeholder="e.g. Vegetarian, Gluten-free, Nut allergy"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6c7b5] text-sm text-[#2e261f] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
                            />
                          </div>

                          {/* Message to Host */}
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6b5844] mb-1">
                              Message for the Hosts (Optional)
                            </label>
                            <textarea
                              rows={2}
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Share your warm wishes or congratulations..."
                              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6c7b5] text-sm text-[#2e261f] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d] resize-none"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit RSVP Button */}
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        id="btn-submit-rsvp"
                        disabled={!rsvpStatus || isSubmitting}
                        className="flex-1 py-3.5 px-6 rounded-2xl bg-[#9c783e] hover:bg-[#856531] text-white font-semibold text-sm tracking-wide shadow-md shadow-[#9c783e]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            <span>Confirming RSVP...</span>
                          </>
                        ) : (
                          <>
                            <span>Confirm RSVP</span>
                            <Sparkles className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {guest?.status && guest.status !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => setIsEditingRsvp(false)}
                          className="py-3.5 px-4 rounded-2xl bg-[#e8decf] text-[#594837] text-xs font-semibold hover:bg-[#dfd3c2] transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Bottom Signature & Host Admin Access Option */}
            <div className="mt-8 pt-6 border-t border-[#e2d5c3]/70 flex flex-col sm:flex-row items-center justify-between text-xs text-[#8c7762] gap-3 mb-4">
              <p className="font-serif italic text-sm text-[#7a6652] text-center sm:text-left">
                With love and warmest regards, {event.hostNames}
              </p>
              <button
                type="button"
                id="btn-admin-access-footer"
                onClick={() => {
                  if (onAdminAccess) {
                    onAdminAccess();
                  } else {
                    window.location.href = '/admin';
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[#85715d] hover:text-[#382b1d] hover:bg-[#eae0cb]/60 transition-colors text-[11px] font-medium cursor-pointer"
              >
                <Lock className="w-3 h-3 text-[#8e6c31]" />
                <span>Admin Login</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox High-Resolution Full Photo Modal */}
      {showLightbox && event.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowLightbox(false)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLightbox(false)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close full photo view"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={event.imageUrl}
              alt={event.title}
              referrerPolicy="no-referrer"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain border border-white/20"
            />
            <div className="mt-3 text-center">
              <p className="text-white font-serif text-base">
                {event.hostNames}
              </p>
              {event.title && (
                <p className="text-white/70 font-sans text-xs tracking-wider uppercase">
                  {event.title}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
