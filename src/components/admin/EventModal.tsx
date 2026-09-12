import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Link as LinkIcon, Check, AlertCircle, Trash2 } from 'lucide-react';
import { EventItem } from '../../types';
import { parseAndConvertImageUrl, testImageLoad } from '../../utils/image';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: EventItem | null;
  onSave: (event: EventItem) => void;
  onDelete?: (eventId: string, eventTitle: string) => void;
  token: string;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  eventToEdit,
  onSave,
  onDelete,
  token
}) => {
  const [slug, setSlug] = useState(eventToEdit?.slug || '');
  const [title, setTitle] = useState(eventToEdit?.title || '');
  const [hostNames, setHostNames] = useState(eventToEdit?.hostNames || '');
  const [celebrationType, setCelebrationType] = useState(eventToEdit?.celebrationType || 'Wedding');
  const [date, setDate] = useState(eventToEdit?.date || '');
  const [time, setTime] = useState(eventToEdit?.time || '4:30 PM');
  const [venueName, setVenueName] = useState(eventToEdit?.venueName || '');
  const [venueAddress, setVenueAddress] = useState(eventToEdit?.venueAddress || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(eventToEdit?.googleMapsUrl || '');
  const [invitationMessage, setInvitationMessage] = useState(
    eventToEdit?.invitationMessage ||
      'Together with our families, we invite you to join us in celebrating our special day with an evening of dinner, music, and joy.'
  );
  const [rsvpDeadline, setRsvpDeadline] = useState(eventToEdit?.rsvpDeadline || '');
  const [imageUrl, setImageUrl] = useState(eventToEdit?.imageUrl || '');
  const [imageSource, setImageSource] = useState<'upload' | 'url'>(
    eventToEdit?.imageSource || (eventToEdit?.imageUrl?.startsWith('http') ? 'url' : 'upload')
  );
  const [imagePosition, setImagePosition] = useState<'top' | 'center' | 'bottom'>(
    eventToEdit?.imagePosition || 'top'
  );
  const [imageAspect, setImageAspect] = useState<'auto' | 'portrait' | 'landscape' | 'square'>(
    eventToEdit?.imageAspect || 'auto'
  );
  const [imageFit, setImageFit] = useState<'cover' | 'contain' | 'natural'>(
    eventToEdit?.imageFit || 'cover'
  );

  const [uploadTab, setUploadTab] = useState<'upload' | 'url'>(
    eventToEdit?.imageSource || (eventToEdit?.imageUrl?.startsWith('http') ? 'url' : 'upload')
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync form state when modal opens or eventToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setSlug(eventToEdit.slug || '');
        setTitle(eventToEdit.title || '');
        setHostNames(eventToEdit.hostNames || '');
        setCelebrationType(eventToEdit.celebrationType || 'Wedding');
        setDate(eventToEdit.date || '');
        setTime(eventToEdit.time || '4:30 PM');
        setVenueName(eventToEdit.venueName || '');
        setVenueAddress(eventToEdit.venueAddress || '');
        setGoogleMapsUrl(eventToEdit.googleMapsUrl || '');
        setInvitationMessage(
          eventToEdit.invitationMessage ||
            'Together with our families, we invite you to join us in celebrating our special day with an evening of dinner, music, and joy.'
        );
        setRsvpDeadline(eventToEdit.rsvpDeadline || '');
        setImageUrl(eventToEdit.imageUrl || '');
        const src = eventToEdit.imageSource || (eventToEdit.imageUrl?.startsWith('http') ? 'url' : 'upload');
        setImageSource(src);
        setUploadTab(src);
        setImagePosition(eventToEdit.imagePosition || 'top');
        setImageAspect(eventToEdit.imageAspect || 'auto');
        setImageFit(eventToEdit.imageFit || 'cover');
      } else {
        setSlug('');
        setTitle('');
        setHostNames('');
        setCelebrationType('Wedding');
        setDate('');
        setTime('4:30 PM');
        setVenueName('');
        setVenueAddress('');
        setGoogleMapsUrl('');
        setInvitationMessage(
          'Together with our families, we invite you to join us in celebrating our special day with an evening of dinner, music, and joy.'
        );
        setRsvpDeadline('');
        setImageUrl('');
        setImageSource('upload');
        setUploadTab('upload');
        setImagePosition('top');
        setImageAspect('auto');
        setImageFit('cover');
      }
      setError(null);
    }
  }, [isOpen, eventToEdit]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WebP).');
      return;
    }

    setIsUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ dataUrl: base64Data, filename: file.name })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        setImageUrl(data.url);
        setImageSource('upload');
      } catch (err: any) {
        setError(err.message || 'Failed to upload photo');
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setError('Error reading local file.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostNames.trim() || !date) {
      setError('Host Names and Date are required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (imageUrl && uploadTab === 'url') {
        const parsed = parseAndConvertImageUrl(imageUrl);
        const test = await testImageLoad(parsed.url, parsed.isGoogleDrive);
        if (!test.valid) {
          setError(test.error || 'Unable to load image from provided URL.');
          setIsSaving(false);
          return;
        }
      }

      const payload = {
        slug: slug.trim(),
        title: title.trim(),
        hostNames: hostNames.trim(),
        celebrationType: celebrationType.trim(),
        date,
        time: time.trim(),
        venueName: venueName.trim(),
        venueAddress: venueAddress.trim(),
        googleMapsUrl: googleMapsUrl.trim(),
        invitationMessage: invitationMessage.trim(),
        rsvpDeadline: rsvpDeadline.trim(),
        imageUrl: imageUrl.trim(),
        imageSource,
        imagePosition,
        imageAspect,
        imageFit
      };

      const url = eventToEdit ? `/api/events/${eventToEdit.id}` : '/api/events';
      const method = eventToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save event');
      }

      onSave(data.event);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#fffefc] rounded-3xl border border-[#ded0be] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-5 sm:px-8 border-b border-[#ebdcc9] bg-[#faf6ef] flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#8e6c31]">
              Event Customizer
            </span>
            <h2 className="font-serif text-2xl text-[#2d241c] font-normal">
              {eventToEdit ? 'Edit Event Details' : 'Create New Event'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#ede4d6] hover:bg-[#e2d5c2] text-[#544331] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-8 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Info: Title & Hosts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                Celebration Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Annual Gala & Celebration"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                Host / Couple Names *
              </label>
              <input
                type="text"
                required
                value={hostNames}
                onChange={(e) => setHostNames(e.target.value)}
                placeholder="e.g. Alex & Sam"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
              />
            </div>
          </div>

          {/* Slug & Celebration Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                Custom URL Slug (Direct Access)
              </label>
              <div className="relative flex items-center">
                <span className="text-xs text-[#9b8976] bg-[#ede5da] px-2.5 py-2.5 rounded-l-xl border border-r-0 border-[#d6c7b5]">
                  /
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. alex-and-sam"
                  className="w-full px-3.5 py-2.5 rounded-r-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
                />
              </div>
              <p className="text-[11px] text-[#998774] mt-1">
                Shareable link: <span className="font-mono text-[#5b4a37]">/:slug</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                Celebration Type / Category
              </label>
              <input
                type="text"
                value={celebrationType}
                onChange={(e) => setCelebrationType(e.target.value)}
                placeholder="e.g. Wedding, Birthday Gala, Anniversary"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
              />
            </div>
          </div>

          {/* Date, Time & RSVP Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                Event Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                Time
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 4:30 PM PDT"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                RSVP Deadline
              </label>
              <input
                type="date"
                value={rsvpDeadline}
                onChange={(e) => setRsvpDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
              />
            </div>
          </div>

          {/* Venue Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                Venue Name
              </label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. Rosewood Conservatory"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
                Venue Full Address
              </label>
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="e.g. 1420 Bellevue Way NE, Bellevue, WA"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d]"
              />
            </div>
          </div>

          {/* Invitation Message */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
              Invitation Note / Letter to Guests
            </label>
            <textarea
              rows={3}
              value={invitationMessage}
              onChange={(e) => setInvitationMessage(e.target.value)}
              placeholder="Write a warm note to your guests..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d] resize-none"
            />
          </div>

          {/* High-Resolution Photo Uploader */}
          <div className="p-4 rounded-2xl bg-[#faf7f2] border border-[#ded0be] space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642]">
                Event Photo / Portrait (Featured Card Image)
              </label>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setUploadTab('upload')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    uploadTab === 'upload'
                      ? 'bg-[#8e6c31] text-white'
                      : 'bg-[#ebdcc8] text-[#5e4b37]'
                  }`}
                >
                  File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setUploadTab('url')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    uploadTab === 'url'
                      ? 'bg-[#8e6c31] text-white'
                      : 'bg-[#ebdcc8] text-[#5e4b37]'
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {uploadTab === 'upload' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-[#cbbbaa] hover:border-[#8e6c31] rounded-2xl p-6 text-center cursor-pointer transition-colors bg-white/70 flex flex-col items-center justify-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  }}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-[#f4ebdd] text-[#8e6c31] flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#4d3d2c]">
                  {isUploading ? 'Uploading High-Resolution Image...' : 'Click or Drag & Drop Photo Here'}
                </p>
                <p className="text-[11px] text-[#998774] mt-0.5">
                  Supports JPG, PNG, WebP up to 50MB
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => {
                      setError(null);
                      const parsed = parseAndConvertImageUrl(e.target.value);
                      setImageUrl(parsed.url);
                      setImageSource('url');
                    }}
                    placeholder="https://example.com/portrait.jpg or Google Drive share link"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6c7b5] text-sm text-[#2d251d] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d] pr-9"
                  />
                  <LinkIcon className="w-4 h-4 text-[#9b8772] absolute right-3 top-3" />
                </div>
                <p className="text-[11px] text-[#8e7862] leading-normal">
                  💡 Supports direct image URLs or Google Drive share links (e.g. <span className="font-mono text-[#544331]">drive.google.com/file/d/.../view</span>). Ensure Google Drive file permission is set to <strong>"Anyone with the link"</strong>.
                </p>
              </div>
            )}

            {/* Photo preview and framing options */}
            {imageUrl && (
              <div className="p-3.5 bg-[#fbf9f5] rounded-xl border border-[#e2d5c4] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#3b2f23]">
                    Photo Display & Framing
                  </span>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Remove Photo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Framing / Orientation */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#665440] uppercase tracking-wider mb-1">
                      Framing / Orientation
                    </label>
                    <select
                      value={imageAspect}
                      onChange={(e) => setImageAspect(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#d6c7b5] text-xs text-[#2d251d] focus:outline-hidden focus:ring-1 focus:ring-[#8e6c31]"
                    >
                      <option value="auto">Auto / Smart Adaptive</option>
                      <option value="portrait">Portrait (4:5 - Best for couples)</option>
                      <option value="landscape">Landscape (16:10 / 16:9)</option>
                      <option value="square">Square (1:1)</option>
                    </select>
                  </div>

                  {/* Focal Position */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#665440] uppercase tracking-wider mb-1">
                      Focal Alignment (Faces)
                    </label>
                    <select
                      value={imagePosition}
                      onChange={(e) => setImagePosition(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#d6c7b5] text-xs text-[#2d251d] focus:outline-hidden focus:ring-1 focus:ring-[#8e6c31]"
                    >
                      <option value="top">Top (Preserves heads & faces)</option>
                      <option value="center">Center</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>
                </div>

                {/* Display Mode */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#665440] uppercase tracking-wider mb-1">
                    Display Fit Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImageFit('cover')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        imageFit === 'cover'
                          ? 'bg-[#8e6c31] text-white border-[#8e6c31]'
                          : 'bg-white text-[#4a3b2c] border-[#d6c7b5] hover:bg-[#ede5da]'
                      }`}
                    >
                      Fill Card Frame (Cover)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageFit('contain')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        imageFit === 'contain'
                          ? 'bg-[#8e6c31] text-white border-[#8e6c31]'
                          : 'bg-white text-[#4a3b2c] border-[#d6c7b5] hover:bg-[#ede5da]'
                      }`}
                    >
                      Show Entire Photo (Contain)
                    </button>
                  </div>
                </div>

                {/* Live Card Preview */}
                <div className="mt-2 pt-2 border-t border-[#ede2d4]">
                  <p className="text-[11px] text-[#85715d] mb-1.5 flex items-center justify-between">
                    <span>Live Invitation Card Preview</span>
                    <span className="text-[10px] italic text-[#9b8570]">How guests will see it</span>
                  </p>
                  <div className="relative w-full max-w-[260px] mx-auto rounded-xl overflow-hidden border border-[#d9ccba] bg-[#ede5da] shadow-inner">
                    <div
                      className={`w-full overflow-hidden ${
                        imageFit === 'contain'
                          ? 'h-48 flex items-center justify-center p-1 bg-[#2b221a]/5'
                          : imageAspect === 'portrait'
                          ? 'aspect-[4/5]'
                          : imageAspect === 'square'
                          ? 'aspect-square'
                          : imageAspect === 'landscape'
                          ? 'aspect-[16/10]'
                          : 'aspect-[4/5]'
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className={`w-full h-full ${
                          imageFit === 'contain'
                            ? 'object-contain max-h-48'
                            : `object-cover ${
                                imagePosition === 'top'
                                  ? 'object-top'
                                  : imagePosition === 'bottom'
                                  ? 'object-bottom'
                                  : 'object-center'
                              }`
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-[#ebdcc9] flex items-center justify-between gap-3">
            {eventToEdit && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(eventToEdit.id, eventToEdit.title);
                }}
                className="py-2.5 px-3 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Event</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-[#ede4d6] hover:bg-[#e2d5c2] text-[#52412e] text-xs font-semibold tracking-wide transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isUploading}
                className="py-2.5 px-6 rounded-xl bg-[#8e6c31] hover:bg-[#785924] text-white text-xs font-semibold tracking-wide shadow-md shadow-[#8e6c31]/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{eventToEdit ? 'Save Changes' : 'Create Event'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
