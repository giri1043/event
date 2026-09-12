import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Setup directories for file uploads
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(process.cwd(), 'uploads');
const DB_FILE = process.env.DB_FILE_PATH ? path.resolve(process.env.DB_FILE_PATH) : path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// MongoDB Connection & Database Name Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://giridha1043_db_user:fKlSyoi5LTc8CVhf@ac-7mjxnjl-shard-00-00.pw6tzia.mongodb.net:27017,ac-7mjxnjl-shard-00-01.pw6tzia.mongodb.net:27017,ac-7mjxnjl-shard-00-02.pw6tzia.mongodb.net:27017/dwrs?ssl=true&authSource=admin&retryWrites=true&w=majority';
const DB_NAME = process.env.MONGODB_DB_NAME || 'event';

mongoose.connect(MONGODB_URI, { dbName: DB_NAME })
  .then(() => {
    console.log(`Connected to MongoDB Atlas database "${DB_NAME}" successfully`);
    seedFromLegacyFileIfNeeded();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Data Interfaces
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

function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

// --- MONGOOSE SCHEMAS & MODELS ---

// Admin User Schema
const adminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, default: 'admin' },
  passwordHash: { type: String, required: true },
  tokens: { type: [String], default: [] }
}, { timestamps: true });

export const AdminUserModel = mongoose.model('AdminUser', adminUserSchema);

// Event Schema
const eventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  title: { type: String, default: '' },
  hostNames: { type: String, required: true },
  celebrationType: { type: String, default: 'Celebration' },
  date: { type: String, required: true },
  time: { type: String, default: '5:00 PM' },
  venueName: { type: String, default: '' },
  venueAddress: { type: String, default: '' },
  googleMapsUrl: { type: String, default: '' },
  invitationMessage: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  imagePosition: { type: String, default: 'top' },
  imageAspect: { type: String, default: 'auto' },
  imageFit: { type: String, default: 'cover' },
  rsvpDeadline: { type: String, default: '' }
}, { timestamps: true });

export const EventModel = mongoose.model('Event', eventSchema);

// Guest Schema
const guestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  eventId: { type: String, required: true, index: true },
  guestCode: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true },
  mobileNumber: { type: String, default: '' },
  maxGuests: { type: Number, default: 2 },
  status: { type: String, enum: ['pending', 'attending', 'declined'], default: 'pending' },
  attendingCount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  dietaryPreferences: { type: String, default: '' }
}, { timestamps: true });

guestSchema.index({ eventId: 1, guestCode: 1 }, { unique: true });

export const GuestModel = mongoose.model('Guest', guestSchema);

// Seed existing data from legacy db.json if MongoDB collection is empty
async function seedFromLegacyFileIfNeeded() {
  try {
    const defaultAdminUser = process.env.ADMIN_USERNAME || 'admin';
    const defaultAdminPass = process.env.ADMIN_PASSWORD || 'admin123';

    let admin = await AdminUserModel.findOne();
    if (!admin) {
      admin = await AdminUserModel.create({
        username: defaultAdminUser,
        passwordHash: hashPassword(defaultAdminPass),
        tokens: []
      });
    }

    const eventCount = await EventModel.countDocuments();
    if (eventCount === 0 && fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.events) && parsed.events.length > 0) {
          for (const ev of parsed.events) {
            await EventModel.updateOne({ id: ev.id }, ev, { upsert: true });
          }
          console.log(`Successfully migrated ${parsed.events.length} events from db.json into MongoDB`);
        }
        if (Array.isArray(parsed.guests) && parsed.guests.length > 0) {
          for (const g of parsed.guests) {
            await GuestModel.updateOne({ id: g.id }, g, { upsert: true });
          }
          console.log(`Successfully migrated ${parsed.guests.length} guests from db.json into MongoDB`);
        }
      } catch (e) {
        console.error('Error reading legacy db.json for seeding:', e);
      }
    }
  } catch (err) {
    console.error('Error initializing MongoDB admin/seed:', err);
  }
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

// Database-backed admin token authentication middleware
async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }
    const token = authHeader.split(' ')[1];
    const admin = await AdminUserModel.findOne({ tokens: token });
    if (!admin) {
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }
    (req as any).adminUser = admin;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Database authentication error' });
  }
}

// --- AUTH API ROUTES ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const defaultAdminUser = process.env.ADMIN_USERNAME || 'admin';
    let admin = await AdminUserModel.findOne();
    if (!admin) {
      admin = await AdminUserModel.create({
        username: defaultAdminUser,
        passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
        tokens: []
      });
    }

    const validUsername = admin.username || defaultAdminUser;
    if (username && username.trim().toLowerCase() !== validUsername.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid administrator username or credentials' });
    }

    if (hashPassword(password) === admin.passwordHash) {
      const token = crypto.randomBytes(32).toString('hex');
      admin.tokens.push(token);
      await admin.save();
      return res.json({ success: true, token, username: validUsername });
    } else {
      return res.status(401).json({ error: 'Invalid administrator password' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error during authentication' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ authenticated: false });
    }
    const token = authHeader.split(' ')[1];
    const admin = await AdminUserModel.findOne({ tokens: token });
    return res.json({
      authenticated: !!admin,
      username: admin ? admin.username : undefined
    });
  } catch (err) {
    return res.json({ authenticated: false });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await AdminUserModel.updateMany({ tokens: token }, { $pull: { tokens: token } });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: true });
  }
});

app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    const admin = (req as any).adminUser;
    if (hashPassword(currentPassword) !== admin.passwordHash) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    if (newUsername && newUsername.trim()) {
      admin.username = newUsername.trim();
    }
    if (newPassword && newPassword.trim()) {
      admin.passwordHash = hashPassword(newPassword.trim());
    }
    await admin.save();
    return res.json({
      success: true,
      message: 'Administrator credentials updated successfully',
      username: admin.username
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update credentials' });
  }
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
app.get('/api/public/primary-event', async (req, res) => {
  try {
    const event = await EventModel.findOne().sort({ createdAt: 1 });
    if (!event) {
      return res.json({ event: null });
    }
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
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching primary event from MongoDB' });
  }
});

// Get general invite by slug
app.get('/api/public/invite/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const event = await EventModel.findOne({ slug: slug.toLowerCase() });
    if (!event) {
      return res.status(404).json({ error: 'Event invitation not found' });
    }

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
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching event invitation from MongoDB' });
  }
});

// Get personalized invite by slug + guestCode
app.get('/api/public/invite/:slug/:guestCode', async (req, res) => {
  try {
    const { slug, guestCode } = req.params;
    const event = await EventModel.findOne({ slug: slug.toLowerCase() });
    if (!event) {
      return res.status(404).json({ error: 'Event invitation not found' });
    }

    const guest = await GuestModel.findOne({
      eventId: event.id,
      guestCode: guestCode.toUpperCase()
    });

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
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching guest invitation from MongoDB' });
  }
});

// Public RSVP Submission
app.post('/api/public/rsvp', async (req, res) => {
  try {
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

    const event = await EventModel.findOne({ slug: slug.toLowerCase() });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let matchedGuest: any = null;

    if (guestCode) {
      matchedGuest = await GuestModel.findOne({
        eventId: event.id,
        guestCode: guestCode.toUpperCase()
      });
    }

    const maxAllowed = matchedGuest ? (matchedGuest.maxGuests || 6) : 6;
    const count = status === 'attending' ? Math.min(maxAllowed, Math.max(1, Number(attendingCount) || 1)) : 0;

    if (matchedGuest) {
      matchedGuest.status = status;
      matchedGuest.attendingCount = count;
      if (name && name.trim()) matchedGuest.name = name.trim();
      if (mobileNumber !== undefined) matchedGuest.mobileNumber = mobileNumber.trim();
      if (notes !== undefined) matchedGuest.notes = notes.trim();
      if (dietaryPreferences !== undefined) matchedGuest.dietaryPreferences = dietaryPreferences.trim();
      await matchedGuest.save();
    } else {
      const cleanName = (name && name.trim()) || 'Attending Guest';
      let newGuestCode = `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      while (await GuestModel.exists({ eventId: event.id, guestCode: newGuestCode })) {
        newGuestCode = `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      }

      matchedGuest = await GuestModel.create({
        id: `gst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        eventId: event.id,
        guestCode: newGuestCode,
        name: cleanName,
        mobileNumber: (mobileNumber || '').trim(),
        maxGuests: Math.max(count, 2),
        status: status,
        attendingCount: count,
        notes: (notes || '').trim(),
        dietaryPreferences: (dietaryPreferences || '').trim()
      });
    }

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
        dietaryPreferences: matchedGuest.dietaryPreferences
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process RSVP in MongoDB' });
  }
});

// --- ADMIN EVENT MANAGEMENT ROUTES ---

// List all events
app.get('/api/events', requireAdmin, async (req, res) => {
  try {
    const events = await EventModel.find().sort({ createdAt: -1 });
    const allGuests = await GuestModel.find();

    const eventsWithStats = events.map(event => {
      const guests = allGuests.filter(g => g.eventId === event.id);
      const totalInvitees = guests.length;
      const attendingCount = guests.filter(g => g.status === 'attending').length;
      const declinedCount = guests.filter(g => g.status === 'declined').length;
      const pendingCount = guests.filter(g => g.status === 'pending').length;
      const totalHeadcount = guests
        .filter(g => g.status === 'attending')
        .reduce((sum, g) => sum + (g.attendingCount || 1), 0);

      return {
        ...event.toObject(),
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events from MongoDB' });
  }
});

// Create event
app.post('/api/events', requireAdmin, async (req, res) => {
  try {
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

    if (!hostNames || !date) {
      return res.status(400).json({ error: 'Host Names and Date are required' });
    }

    let cleanSlug = (slug || title || hostNames)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanSlug) cleanSlug = `event-${Date.now()}`;

    if (await EventModel.exists({ slug: cleanSlug })) {
      cleanSlug = `${cleanSlug}-${crypto.randomBytes(2).toString('hex')}`;
    }

    const newEvent = await EventModel.create({
      id: `evt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      slug: cleanSlug,
      title: title || '',
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
      rsvpDeadline: rsvpDeadline || ''
    });

    res.json({ success: true, event: newEvent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event in MongoDB' });
  }
});

// Update event
app.put('/api/events/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await EventModel.findOne({ id });
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
      const existing = await EventModel.findOne({ slug: cleanSlug, id: { $ne: id } });
      if (existing) {
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

    await event.save();
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event in MongoDB' });
  }
});

// Delete event
app.delete('/api/events/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEvent = await EventModel.findOneAndDelete({ id });
    if (!deletedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await GuestModel.deleteMany({ eventId: id });
    res.json({ success: true, message: 'Event and associated guests deleted from MongoDB' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event from MongoDB' });
  }
});

// --- ADMIN GUEST LIST & RSVP TRACKER ROUTES ---

// Get guests and metrics for an event
app.get('/api/events/:id/guests', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await EventModel.findOne({ id });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const guests = await GuestModel.find({ eventId: id }).sort({ createdAt: -1 });
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch guests from MongoDB' });
  }
});

// Add guest to event
app.post('/api/events/:id/guests', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobileNumber, maxGuests, customCode, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Guest name is required' });
    }

    const event = await EventModel.findOne({ id });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let guestCode = customCode ? customCode.trim().toUpperCase() : `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    while (await GuestModel.exists({ eventId: id, guestCode })) {
      guestCode = `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    const newGuest = await GuestModel.create({
      id: `gst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      eventId: id,
      guestCode,
      name: name.trim(),
      mobileNumber: (mobileNumber || '').trim(),
      maxGuests: Math.max(1, Number(maxGuests) || 2),
      status: 'pending',
      attendingCount: 0,
      notes: (notes || '').trim(),
      dietaryPreferences: ''
    });

    res.json({ success: true, guest: newGuest });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create guest in MongoDB' });
  }
});

// Update guest
app.put('/api/events/:id/guests/:guestId', requireAdmin, async (req, res) => {
  try {
    const { id, guestId } = req.params;
    const { name, mobileNumber, maxGuests, guestCode, status, attendingCount, notes, dietaryPreferences } = req.body;

    const guest = await GuestModel.findOne({ id: guestId, eventId: id });
    if (!guest) {
      return res.status(404).json({ error: 'Guest record not found' });
    }

    if (name !== undefined) guest.name = name.trim();
    if (mobileNumber !== undefined) guest.mobileNumber = mobileNumber.trim();
    if (maxGuests !== undefined) guest.maxGuests = Math.max(1, Number(maxGuests) || 1);
    if (guestCode && guestCode !== guest.guestCode) {
      const cleanCode = guestCode.trim().toUpperCase();
      const existing = await GuestModel.findOne({ eventId: id, id: { $ne: guestId }, guestCode: cleanCode });
      if (existing) {
        return res.status(400).json({ error: 'Guest code already in use for this event' });
      }
      guest.guestCode = cleanCode;
    }
    if (status !== undefined && ['pending', 'attending', 'declined'].includes(status)) {
      guest.status = status as any;
      if (status === 'declined') {
        guest.attendingCount = 0;
      }
    }
    if (attendingCount !== undefined) {
      guest.attendingCount = Math.max(0, Number(attendingCount) || 0);
    }
    if (notes !== undefined) guest.notes = notes;
    if (dietaryPreferences !== undefined) guest.dietaryPreferences = dietaryPreferences;

    await guest.save();
    res.json({ success: true, guest });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update guest in MongoDB' });
  }
});

// Delete guest
app.delete('/api/events/:id/guests/:guestId', requireAdmin, async (req, res) => {
  try {
    const { id, guestId } = req.params;
    const deleted = await GuestModel.findOneAndDelete({ id: guestId, eventId: id });
    if (!deleted) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    res.json({ success: true, message: 'Guest deleted from MongoDB' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete guest from MongoDB' });
  }
});

// CSV Import guests
app.post('/api/events/:id/guests/import', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { guests } = req.body;

    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ error: 'No guest records provided' });
    }

    const event = await EventModel.findOne({ id });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const addedGuests: any[] = [];

    for (const item of guests) {
      const name = item.name ? String(item.name).trim() : '';
      if (!name) continue;

      let code = item.guestCode ? String(item.guestCode).trim().toUpperCase() : '';
      if (!code || await GuestModel.exists({ eventId: id, guestCode: code })) {
        code = `G-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      }

      const newGuest = await GuestModel.create({
        id: `gst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        eventId: id,
        guestCode: code,
        name,
        mobileNumber: item.mobileNumber ? String(item.mobileNumber).trim() : '',
        maxGuests: Math.max(1, Number(item.maxGuests) || 2),
        status: item.status && ['pending', 'attending', 'declined'].includes(item.status) ? item.status : 'pending',
        attendingCount: Number(item.attendingCount) || 0,
        notes: item.notes ? String(item.notes).trim() : '',
        dietaryPreferences: item.dietaryPreferences ? String(item.dietaryPreferences).trim() : ''
      });

      addedGuests.push(newGuest);
    }

    res.json({ success: true, count: addedGuests.length, guests: addedGuests });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import guests to MongoDB' });
  }
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
