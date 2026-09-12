import { GuestItem } from '../types';

export function exportGuestsToCSV(guests: GuestItem[], eventTitle: string) {
  const headers = ['Name', 'Mobile Number', 'Guest Code', 'Max Allowed', 'Status', 'Attending Count', 'Notes', 'Dietary Preferences'];
  
  const rows = guests.map(g => [
    `"${(g.name || '').replace(/"/g, '""')}"`,
    `"${(g.mobileNumber || '').replace(/"/g, '""')}"`,
    `"${(g.guestCode || '').replace(/"/g, '""')}"`,
    g.maxGuests || 2,
    `"${g.status}"`,
    g.attendingCount || 0,
    `"${(g.notes || '').replace(/"/g, '""')}"`,
    `"${(g.dietaryPreferences || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanTitle = eventTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
  link.setAttribute('download', `guests_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseCSVToGuests(csvText: string): Partial<GuestItem>[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header line
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));

  const results: Partial<GuestItem>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || !values[0]) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });

    const name = rowObj['name'] || values[0];
    if (!name) continue;

    const mobile = rowObj['mobilenumber'] || rowObj['mobile'] || rowObj['phone'] || values[1] || '';
    const code = rowObj['guestcode'] || rowObj['code'] || values[2] || '';
    const maxGuests = parseInt(rowObj['maxallowed'] || rowObj['maxguests'] || values[3], 10) || 2;
    const statusRaw = (rowObj['status'] || values[4] || 'pending').toLowerCase();
    const status = ['attending', 'declined'].includes(statusRaw) ? (statusRaw as 'attending' | 'declined') : 'pending';
    const attendingCount = parseInt(rowObj['attendingcount'] || rowObj['count'] || values[5], 10) || (status === 'attending' ? 1 : 0);
    const notes = rowObj['notes'] || values[6] || '';
    const dietary = rowObj['dietarypreferences'] || rowObj['dietary'] || values[7] || '';

    results.push({
      name,
      mobileNumber: mobile,
      guestCode: code,
      maxGuests,
      status,
      attendingCount,
      notes,
      dietaryPreferences: dietary
    });
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
