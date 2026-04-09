export type StarterProspectCsvRow = {
  company: string;
  trade: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export type ProspectImportPayloadRow = {
  companyName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  serviceInterest: string | null;
  notes: string | null;
};

const REQUIRED_HEADERS = ['company', 'trade', 'city', 'website', 'phone', 'email', 'address', 'notes'] as const;

function normalizeCell(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '';
}

function isPlausibleEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseCsvRows(csvText: string) {
  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i += 1) {
    const char = normalizedText[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalizedText[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
        continue;
      }

      currentField += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (char === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

function parseCityAndState(rawCity: string | null) {
  if (!rawCity) {
    return {
      city: null as string | null,
      state: null as string | null
    };
  }

  const normalized = rawCity.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return {
      city: null,
      state: null
    };
  }

  if (normalized.includes(',')) {
    const [cityPart, ...rest] = normalized.split(',');
    const city = cityPart.trim();
    const remainder = rest.join(',').trim();
    const stateToken = remainder.split(/\s+/)[0]?.trim();

    return {
      city: city || null,
      state: /^[A-Za-z]{2}$/.test(stateToken ?? '') ? stateToken.toUpperCase() : remainder || null
    };
  }

  const spaceParts = normalized.split(' ');
  const maybeState = spaceParts.at(-1) ?? '';
  if (/^[A-Za-z]{2}$/.test(maybeState) && spaceParts.length > 1) {
    return {
      city: spaceParts.slice(0, -1).join(' '),
      state: maybeState.toUpperCase()
    };
  }

  return {
    city: normalized,
    state: null
  };
}

function combineNotes(parts: Array<string | null>) {
  const unique = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return unique.length > 0 ? unique.join('\n') : null;
}

export function parseStarterProspectCsv(csvText: string): StarterProspectCsvRow[] {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim().toLowerCase()));
  const headerMap = new Map(headers.map((header, index) => [header.toLowerCase(), index]));

  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headerMap.has(requiredHeader)) {
      throw new Error(
        `CSV is missing a required header: ${requiredHeader}. Expected columns: ${REQUIRED_HEADERS.join(', ')}`
      );
    }
  }

  return rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    const getValue = (header: (typeof REQUIRED_HEADERS)[number]) =>
      normalizeCell(row[headerMap.get(header) ?? -1] ?? '');

    const company = getValue('company');
    if (!company) {
      throw new Error(`Row ${rowNumber} is missing a company name.`);
    }

    return {
      company,
      trade: getValue('trade') || null,
      city: getValue('city') || null,
      website: getValue('website') || null,
      phone: getValue('phone') || null,
      email: getValue('email') || null,
      address: getValue('address') || null,
      notes: getValue('notes') || null
    };
  });
}

export function mapStarterProspectCsvRows(rows: StarterProspectCsvRow[]): ProspectImportPayloadRow[] {
  return rows.map((row) => {
    const { city, state } = parseCityAndState(row.city);
    const supplementalNotes = combineNotes([
      row.notes,
      row.website ? `Website: ${row.website}` : null,
      row.address ? `Address: ${row.address}` : null,
      row.email && !isPlausibleEmail(row.email) ? `Email: ${row.email}` : null
    ]);

    return {
      companyName: row.company,
      contactPhone: row.phone,
      contactEmail: row.email && isPlausibleEmail(row.email) ? row.email : null,
      city,
      state,
      serviceInterest: row.trade,
      notes: supplementalNotes
    };
  });
}

export function buildStarterProspectImportBody(rows: StarterProspectCsvRow[]) {
  return {
    defaultSourceLabel: 'houston_starter_list',
    prospects: mapStarterProspectCsvRows(rows)
  };
}
