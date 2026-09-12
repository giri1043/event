import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageCircle, ExternalLink, QrCode } from 'lucide-react';
import { EventItem, GuestItem } from '../../types';
import { QRCodeCanvas } from '../../utils/qr';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem;
  guests: GuestItem[];
  preselectedGuest?: GuestItem | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  event,
  guests,
  preselectedGuest
}) => {
  const [selectedGuestId, setSelectedGuestId] = useState<string>(
    preselectedGuest?.id || ''
  );
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const currentGuest = guests.find((g) => g.id === selectedGuestId) || preselectedGuest;

  // Clean public direct URLs:
  // General: /:slug
  // Personalized: /:slug/:guestCode
  const invitePath = currentGuest
    ? `/${event.slug}/${currentGuest.guestCode}`
    : `/${event.slug}`;

  const fullUrl = `${origin}${invitePath}`;

  // Pre-formatted message
  const titleSegment = event.title ? ` for "${event.title}"` : '';
  const whatsappText = currentGuest
    ? `Dear ${currentGuest.name},\n\nYou are cordially invited to celebrate with ${event.hostNames}${titleSegment} on ${event.date}.\n\nKindly view your formal digital invitation and RSVP here:\n${fullUrl}`
    : `You are cordially invited to celebrate with ${event.hostNames}${titleSegment} on ${event.date}.\n\nKindly view your digital invitation and RSVP here:\n${fullUrl}`;

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;
  const smsUrl = `sms:?&body=${encodeURIComponent(whatsappText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg bg-[#fffefc] rounded-3xl border border-[#ded0be] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-5 sm:px-8 border-b border-[#ebdcc9] bg-[#faf6ef] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#f2ebd9] border border-[#d9ccb6] flex items-center justify-center text-[#8e6c31]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8e6c31]">
                Quick Share
              </span>
              <h2 className="font-serif text-xl text-[#2d241c] font-normal">
                Share Digital Invitation
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#ede4d6] hover:bg-[#e2d5c2] text-[#544331] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-8 overflow-y-auto space-y-6">
          {/* Recipient Selection: General vs Personalized Guest Link */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1.5">
              Select Recipient Type
            </label>
            <select
              value={selectedGuestId}
              onChange={(e) => setSelectedGuestId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
            >
              <option value="">🌐 General Public Invitation Link (Anyone can RSVP)</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  👤 {g.name} (Code: {g.guestCode}) — {g.status}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#917f6c] mt-1">
              {currentGuest
                ? `Personalized invite for ${currentGuest.name}. Opens envelope with personalized greeting.`
                : 'General link for open distribution or group announcements.'}
            </p>
          </div>

          {/* QR Code Section */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#faf6ef] border border-[#ded0be] text-center">
            <QRCodeCanvas value={fullUrl} size={180} />
            <p className="text-xs text-[#6e5a46] mt-3 font-medium">
              Scan to preview or open invitation on mobile
            </p>
            <span className="text-[11px] text-[#998774] font-mono mt-0.5">
              {invitePath}
            </span>
          </div>

          {/* Direct Link Copy */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1.5">
              Direct Invitation URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fullUrl}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-xs font-mono text-[#2d251d] truncate select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2.5 rounded-xl bg-[#8e6c31] hover:bg-[#785924] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Share Buttons */}
          <div className="space-y-2.5 pt-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#695642]">
              One-Click Direct Sharing
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WhatsApp Share */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20b858] text-white font-medium text-xs tracking-wide shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Send via WhatsApp</span>
              </a>

              {/* SMS Share */}
              <a
                href={smsUrl}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#4a6b82] hover:bg-[#3d596e] text-white font-medium text-xs tracking-wide shadow-sm transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Send via SMS / Text</span>
              </a>
            </div>

            {/* Test View in New Tab */}
            <a
              href={invitePath}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#ede4d6] hover:bg-[#e2d5c2] text-[#4d3d2c] font-medium text-xs tracking-wide transition-colors"
            >
              <span>Test Preview in New Tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
