import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Setup directories for persistence and file uploads
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(process.cwd(), 'uploads');
const DB_FILE = process.env.DB_FILE_PATH ? path.resolve(process.env.DB_FILE_PATH) : path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Data Types
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
  imagePosition?: 'top' | 'center' | 'bottom';
  imageAspect?: 'auto' | 'portrait' | 'landscape' | 'square';
  imageFit?: 'cover' | 'contain' | 'natural';
  rsvpDeadline?: string;
  createdAt: string;
  updatedAt: string;
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
  updatedAt: string;
}

interface DatabaseSchema {
  adminUsername?: string;
  adminPasswordHash: string;
  events: EventItem[];
  guests: GuestItem[];
}

function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

// Read database
function readDb(): DatabaseSchema {
  const defaultAdminUser = process.env.ADMIN_USERNAME || 'admin';
  const defaultAdminPass = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.adminUsername) {
        parsed.adminUsername = defaultAdminUser;
      }
      if (!Array.isArray(parsed.events)) {
        parsed.events = [];
      }
      if (!Array.isArray(parsed.guests)) {
        parsed.guests = [];
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading db.json, reinitializing...', err);
  }

  // Initial fresh database with zero mock or sample data
  const initialDb: DatabaseSchema = {
    adminUsername: defaultAdminUser,
    adminPasswordHash: hashPassword(defaultAdminPass),
    events: [],
    guests: []
  };

  writeDb(initialDb);
  return initialDb;
}

// Write database atomically
function writeDb(db: DatabaseSchema) {
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

// Configure CORS for production domains or allowed origins
const allowedOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON body parser with 50mb limit for high-res photo uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads serving
app.use('/uploads', express.static(UPLOADS_DIR));

// Simple in-memory session tokens for admin auth
const activeAdminTokens = new Set<string>();

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }
  const token = authHeader.split(' ')[1];
  if (!activeAdminTokens.has(token)) {
    return res.status(401).json({ error: 'Session expired or invalid.' });
  }
  next();
}

// --- AUTH API ROUTES ---
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const db = readDb();
  const validUsername = db.adminUsername || 'admin';

  // If username is provided, check it matches
  if (username && username.trim().toLowerCase() !== validUsername.toLowerCase()) {
    return res.status(401).json({ error: 'Invalid administrator username or credentials' });
  }

  if (hashPassword(password) === db.adminPasswordHash) {
    const token = crypto.randomBytes(32).toString('hex');
    activeAdminTokens.add(token);
    return res.json({ success: true, token, username: validUsername });
  } else {
    return res.status(401).json({ error: 'Invalid administrator password' });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }
  const token = authHeader.split(' ')[1];
  const isValid = activeAdminTokens.has(token);
  const db = readDb();
  return res.json({
    authenticated: isValid,
    username: isValid ? (db.adminUsername || 'admin') : undefined
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeAdminTokens.delete(token);
  }
  res.json({ success: true });
});

app.post('/api/auth/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body;
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required' });
  }
  const db = readDb();
  if (hashPassword(currentPassword) !== db.adminPasswordHash) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (newUsername && newUsername.trim()) {
    db.adminUsername = newUsername.trim();
  }
  if (newPassword && newPassword.trim()) {
    db.adminPasswordHash = hashPassword(newPassword.trim());
  }
  writeDb(db);
  res.json({
    success: true,
    message: 'Administrator credentials updated successfully',
    username: db.adminUsername || 'admin'
  });
});

// --- IMAGE UPLOAD ROUTE ---
app.post('/api/upload', requireAdmin, (req, res) => {
  try {
    const { dataUrl, filename } = req.body;
    if (!dataUrl || !dataUrl.includes(';base64,')) {
      return res.status(400).json({ error: 'Invalid base64 image format' });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid data URL string' });
    }

    const ext = matches[1].includes('png') ? 'png' : matches[1].includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');
    const safeName = `photo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/${safeName}`;
    return res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('File upload error:', err);
    return res.status(500).json({ error: 'Failed to process file upload' });
  }
});

// --- PUBLIC GUEST INVITATION ROUTES (COMPLETELY ISOLATED) ---

// Get primary / default active event for root route
app.get('/api/public/primary-event', (req, res) => {
  const db = readDb();
  if (db.events.length === 0) {
    return res.json({ event: null });
  }
  const event = db.events[0];
  return res.json({
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      hostNames: event.hostNames,
      celebrationType: event.celebrationType,
      date: event.date,
      time: event.time,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      googleMapsUrl: event.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress || event.venueName)}`,
      invitationMessage: event.invitationMessage,
      imageUrl: event.imageUrl,
      imagePosition: event.imagePosition,
      imageAspect: event.imageAspect,
      imageFit: event.imageFit,
      rsvpDeadline: event.rsvpDeadline
    }
  });
});

// Get general invite by slug
app.get('/api/public/invite/:slug', (req, res) => {
  const { slug } = req.params;
  const db = readDb();
  const event = db.events.find(e => e.slug.toLowerCase() === slug.toLowerCase());
  if (!event) {
    return res.status(404).json({ error: 'Event invitation not found' });
  }

  // Return isolated event information only (NO guest list, NO admin info)
  return res.json({
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      hostNames: event.hostNames,
      celebrationType: event.celebrationType,
      date: event.date,
      time: event.time,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      googleMapsUrl: event.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress || event.venueName)}`,
      invitationMessage: event.invitationMessage,
      imageUrl: event.imageUrl,
      imagePosition: event.imagePosition,
      imageAspect: event.imageAspect,
      imageFit: event.imageFit,
      rsvpDeadline: event.rsvpDeadline
    },
    guest: null
  });
});

// Get personalized invite by slug + guestCode
app.get('/api/public/invite/:slug/:guestCode', (req, res) => {
  const { slug, guestCode } = req.params;
  const db = readDb();
  const event = db.events.find(e => e.slug.toLowerCase() === slug.toLowerCase());
  if (!event) {
    return res.status(404).json({ error: 'Event invitation not found' });
  }

  const guest = db.guests.find(
    g => g.eventId === event.id && g.guestCode.toLowerCase() === guestCode.toLowerCase()
  );

  return res.json({
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      hostNames: event.hostNames,
      celebrationType: event.celebrationType,
      date: event.date,
      time: event.time,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      googleMapsUrl: event.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress || event.venueName)}`,
      invitationMessage: event.invitationMessage,
      imageUrl: event.imageUrl,
      imagePosition: event.imagePosition,
      imageAspect: event.imageAspect,
      imageFit: event.imageFit,
      rsvpDeadline: event.rsvpDeadline
    },
    guest: guest
      ? {
          id: guest.id,
          guestCode: guest.guestCode,
          name: guest.name,
          mobileNumber: guest.mobileNumber,
          maxGuests: guest.maxGuests || 2,
          status: guest.status,
          attendingCount: guest.attendingCount,
          notes: guest.notes,
          dietaryPreferences: guest.dietaryPreferences
        }
      : null
  });
});

// Public RSVP Submission
app.post('/api/public/rsvp', (req, res) => {
  const {
    slug,
    guestCode,
    name,
    mobileNumber,
    status,
    attendingCount,
    notes,
    dietaryPreferences
  } = req.body;

  if (!slug || !status || !['attending', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Valid event slug and status ("attending" or "declined") required' });
  }

  const db = readDb();
  const event = db.events.find(e => e.slug.toLowerCase() === slug.toLowerCase());
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  let matchedGuest: GuestItem | undefined;

  if (guestCode) {
    matchedGuest = db.guests.find(
      g => g.eventId === event.id && g.guestCode.toLowerCase() === guestCode.toLowerCase()
    );
  }

  const maxAllowed = matchedGuest ? (matchedGuest.maxGuests || 6) : 6;
  const count = status === 'attending' ? Math.min(maxAllowed, Math.max(1, Number(attendingCount) || 1)) : 0;

  if (matchedGuest) {
    // Update existing personalized guest record
    matchedGuest.status = status;
    matchedGuest.attendingCount = count;
    if (name && name.trim()) matchedGuest.name = name.trim();
    if (mobileNumber !== undefined) matchedGuest.mobileNumber = mobileNumber.trim();
    if (notes !== undefined) matchedGuest.notes = notes.trim();
    if (dietaryPreferences !== undefined) matchedGuest.dietaryPreferences = dietaryPreferences.trim();
    matchedGuest.updatedAt = new Date().toISOString();
  } else {
    // General public guest RSVP submission
    const cleanName = (name && name.trim()) || 'Attending Guest';
    let newGuestCode = `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    if (db.guests.some(g => g.eventId === event.id && g.guestCode.toUpperCase() === newGuestCode)) {
      newGuestCode = `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    matchedGuest = {
      id: `gst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      eventId: event.id,
      guestCode: newGuestCode,
      name: cleanName,
      mobileNumber: (mobileNumber || '').trim(),
      maxGuests: Math.max(count, 2),
      status: status,
      attendingCount: count,
      notes: (notes || '').trim(),
      dietaryPreferences: (dietaryPreferences || '').trim(),
      updatedAt: new Date().toISOString()
    };
    db.guests.push(matchedGuest);
  }

  writeDb(db);

  return res.json({
    success: true,
    message: status === 'attending' ? 'RSVP received! We look forward to celebrating with you.' : 'Thank you for letting us know. You will be missed!',
    guest: {
      id: matchedGuest.id,
      eventId: matchedGuest.eventId,
      guestCode: matchedGuest.guestCode,
      name: matchedGuest.name,
      mobileNumber: matchedGuest.mobileNumber,
      maxGuests: matchedGuest.maxGuests,
      status: matchedGuest.status,
      attendingCount: matchedGuest.attendingCount,
      notes: matchedGuest.notes,
      dietaryPreferences: matchedGuest.dietaryPreferences,
      updatedAt: matchedGuest.updatedAt
    }
  });
});

// --- ADMIN EVENT MANAGEMENT ROUTES ---

// List all events
app.get('/api/events', requireAdmin, (req, res) => {
  const db = readDb();
  // Include metrics summary for each event
  const eventsWithStats = db.events.map(event => {
    const guests = db.guests.filter(g => g.eventId === event.id);
    const totalInvitees = guests.length;
    const attendingCount = guests.filter(g => g.status === 'attending').length;
    const declinedCount = guests.filter(g => g.status === 'declined').length;
    const pendingCount = guests.filter(g => g.status === 'pending').length;
    const totalHeadcount = guests
      .filter(g => g.status === 'attending')
      .reduce((sum, g) => sum + (g.attendingCount || 1), 0);

    return {
      ...event,
      stats: {
        totalInvitees,
        attendingCount,
        declinedCount,
        pendingCount,
        totalHeadcount
      }
    };
  });

  res.json({ events: eventsWithStats });
});

// Create event
app.post('/api/events', requireAdmin, (req, res) => {
  const {
    slug,
    title,
    hostNames,
    celebrationType,
    date,
    time,
    venueName,
    venueAddress,
    googleMapsUrl,
    invitationMessage,
    imageUrl,
    imagePosition,
    imageAspect,
    imageFit,
    rsvpDeadline
  } = req.body;

  if (!title || !hostNames || !date) {
    return res.status(400).json({ error: 'Title, Host Names, and Date are required' });
  }

  const db = readDb();
  let cleanSlug = (slug || title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleanSlug) cleanSlug = `event-${Date.now()}`;

  // Check unique slug
  if (db.events.some(e => e.slug.toLowerCase() === cleanSlug.toLowerCase())) {
    cleanSlug = `${cleanSlug}-${crypto.randomBytes(2).toString('hex')}`;
  }

  const newEvent: EventItem = {
    id: `evt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    slug: cleanSlug,
    title,
    hostNames,
    celebrationType: celebrationType || 'Celebration',
    date,
    time: time || '5:00 PM',
    venueName: venueName || '',
    venueAddress: venueAddress || '',
    googleMapsUrl: googleMapsUrl || (venueAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueAddress)}` : ''),
    invitationMessage: invitationMessage || 'You are cordially invited to celebrate this memorable occasion with us.',
    imageUrl: imageUrl || '',
    imagePosition: imagePosition || 'top',
    imageAspect: imageAspect || 'auto',
    imageFit: imageFit || 'cover',
    rsvpDeadline: rsvpDeadline || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.events.push(newEvent);
  writeDb(db);

  res.json({ success: true, event: newEvent });
});

// Update event
app.put('/api/events/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const event = db.events.find(e => e.id === id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const {
    slug,
    title,
    hostNames,
    celebrationType,
    date,
    time,
    venueName,
    venueAddress,
    googleMapsUrl,
    invitationMessage,
    imageUrl,
    imagePosition,
    imageAspect,
    imageFit,
    rsvpDeadline
  } = req.body;

  if (slug && slug !== event.slug) {
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (db.events.some(e => e.id !== id && e.slug.toLowerCase() === cleanSlug.toLowerCase())) {
      return res.status(400).json({ error: 'An event with this custom slug already exists' });
    }
    event.slug = cleanSlug;
  }

  if (title !== undefined) event.title = title;
  if (hostNames !== undefined) event.hostNames = hostNames;
  if (celebrationType !== undefined) event.celebrationType = celebrationType;
  if (date !== undefined) event.date = date;
  if (time !== undefined) event.time = time;
  if (venueName !== undefined) event.venueName = venueName;
  if (venueAddress !== undefined) event.venueAddress = venueAddress;
  if (googleMapsUrl !== undefined) {
    event.googleMapsUrl = googleMapsUrl;
  } else if (venueAddress) {
    event.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueAddress)}`;
  }
  if (invitationMessage !== undefined) event.invitationMessage = invitationMessage;
  if (imageUrl !== undefined) event.imageUrl = imageUrl;
  if (imagePosition !== undefined) event.imagePosition = imagePosition;
  if (imageAspect !== undefined) event.imageAspect = imageAspect;
  if (imageFit !== undefined) event.imageFit = imageFit;
  if (rsvpDeadline !== undefined) event.rsvpDeadline = rsvpDeadline;
  event.updatedAt = new Date().toISOString();

  writeDb(db);
  res.json({ success: true, event });
});

// Delete event
app.delete('/api/events/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const eventIndex = db.events.findIndex(e => e.id === id);
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }

  db.events.splice(eventIndex, 1);
  // Also remove guests for this event
  db.guests = db.guests.filter(g => g.eventId !== id);
  writeDb(db);

  res.json({ success: true, message: 'Event and associated guests deleted' });
});

// --- ADMIN GUEST LIST & RSVP TRACKER ROUTES ---

// Get guests and metrics for an event
app.get('/api/events/:id/guests', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const event = db.events.find(e => e.id === id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const guests = db.guests.filter(g => g.eventId === id);
  const totalInvitees = guests.length;
  const attendingCount = guests.filter(g => g.status === 'attending').length;
  const declinedCount = guests.filter(g => g.status === 'declined').length;
  const pendingCount = guests.filter(g => g.status === 'pending').length;
  const totalHeadcount = guests
    .filter(g => g.status === 'attending')
    .reduce((sum, g) => sum + (g.attendingCount || 1), 0);

  res.json({
    event,
    guests,
    metrics: {
      totalInvitees,
      attendingCount,
      declinedCount,
      pendingCount,
      totalHeadcount
    }
  });
});

// Add guest to event
app.post('/api/events/:id/guests', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, mobileNumber, maxGuests, customCode, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Guest name is required' });
  }

  const db = readDb();
  const event = db.events.find(e => e.id === id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  let guestCode = customCode ? customCode.trim().toUpperCase() : `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  // Ensure unique code per event
  if (db.guests.some(g => g.eventId === id && g.guestCode.toUpperCase() === guestCode)) {
    guestCode = `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  const newGuest: GuestItem = {
    id: `gst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    eventId: id,
    guestCode,
    name: name.trim(),
    mobileNumber: (mobileNumber || '').trim(),
    maxGuests: Math.max(1, Number(maxGuests) || 2),
    status: 'pending',
    attendingCount: 0,
    notes: (notes || '').trim(),
    dietaryPreferences: '',
    updatedAt: new Date().toISOString()
  };

  db.guests.push(newGuest);
  writeDb(db);

  res.json({ success: true, guest: newGuest });
});

// Update guest
app.put('/api/events/:id/guests/:guestId', requireAdmin, (req, res) => {
  const { id, guestId } = req.params;
  const { name, mobileNumber, maxGuests, guestCode, status, attendingCount, notes, dietaryPreferences } = req.body;

  const db = readDb();
  const guest = db.guests.find(g => g.id === guestId && g.eventId === id);
  if (!guest) {
    return res.status(404).json({ error: 'Guest record not found' });
  }

  if (name !== undefined) guest.name = name.trim();
  if (mobileNumber !== undefined) guest.mobileNumber = mobileNumber.trim();
  if (maxGuests !== undefined) guest.maxGuests = Math.max(1, Number(maxGuests) || 1);
  if (guestCode && guestCode !== guest.guestCode) {
    const cleanCode = guestCode.trim().toUpperCase();
    if (db.guests.some(g => g.eventId === id && g.id !== guestId && g.guestCode.toUpperCase() === cleanCode)) {
      return res.status(400).json({ error: 'Guest code already in use for this event' });
    }
    guest.guestCode = cleanCode;
  }
  if (status !== undefined && ['pending', 'attending', 'declined'].includes(status)) {
    guest.status = status;
    if (status === 'declined') {
      guest.attendingCount = 0;
    }
  }
  if (attendingCount !== undefined) {
    guest.attendingCount = Math.max(0, Number(attendingCount) || 0);
  }
  if (notes !== undefined) guest.notes = notes;
  if (dietaryPreferences !== undefined) guest.dietaryPreferences = dietaryPreferences;
  guest.updatedAt = new Date().toISOString();

  writeDb(db);
  res.json({ success: true, guest });
});

// Delete guest
app.delete('/api/events/:id/guests/:guestId', requireAdmin, (req, res) => {
  const { id, guestId } = req.params;
  const db = readDb();
  const index = db.guests.findIndex(g => g.id === guestId && g.eventId === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  db.guests.splice(index, 1);
  writeDb(db);
  res.json({ success: true, message: 'Guest deleted' });
});

// CSV Import guests
app.post('/api/events/:id/guests/import', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { guests } = req.body;

  if (!Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({ error: 'No guest records provided' });
  }

  const db = readDb();
  const event = db.events.find(e => e.id === id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const addedGuests: GuestItem[] = [];

  for (const item of guests) {
    const name = item.name ? String(item.name).trim() : '';
    if (!name) continue;

    let code = item.guestCode ? String(item.guestCode).trim().toUpperCase() : '';
    if (!code || db.guests.some(g => g.eventId === id && g.guestCode.toUpperCase() === code)) {
      code = `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    const newGuest: GuestItem = {
      id: `gst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      eventId: id,
      guestCode: code,
      name,
      mobileNumber: item.mobileNumber ? String(item.mobileNumber).trim() : '',
      maxGuests: Math.max(1, Number(item.maxGuests) || 2),
      status: item.status && ['pending', 'attending', 'declined'].includes(item.status) ? item.status : 'pending',
      attendingCount: Number(item.attendingCount) || 0,
      notes: item.notes ? String(item.notes).trim() : '',
      dietaryPreferences: item.dietaryPreferences ? String(item.dietaryPreferences).trim() : '',
      updatedAt: new Date().toISOString()
    };

    db.guests.push(newGuest);
    addedGuests.push(newGuest);
  }

  writeDb(db);
  res.json({ success: true, count: addedGuests.length, guests: addedGuests });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Vite middleware & Production Server boot
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Invitation Server running on port ${PORT}`);
  });
}

startServer();
