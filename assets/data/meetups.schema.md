# meetups.json schema (human-readable)

File: `assets/data/meetups.json`

This file is the source of truth for the Meetups map on bitcoindiana.org.

## Top-level format
- The file must be a JSON **array**:
  ```json
  [
    { "...meetup..." },
    { "...meetup..." }
  ]

Each meetup is a JSON object with the fields below.

---

## Fields

### id (required)
**Type:** string  
**Purpose:** stable identifier used for updates and de-duplication.

**Rules**
- Must be unique across the file.
- Use kebab-case.
- Should not change once published.

**Example**
```json
"id": "indianapolis-bitcoin-meetup"
```

---

### name (required)
**Type:** string  
**Purpose:** display name on the map and in search.

**Example**
```json
"name": "Indy Bitcoin Meetup"
```

---

### frequency (recommended)
**Type:** string  
**Purpose:** human-readable frequency.

**Acceptable examples**
- `"Weekly"`
- `"Monthly"`
- `"Bi-monthly"`
- `"Quarterly"`
- `"Varies"`

---

### schedule (recommended)
**Type:** string  
**Purpose:** compact, readable schedule string.

**Examples**
- `"Monthly | 3rd Wednesday | 7:00 PM ET"`
- `"Weekly | Tuesdays | 6:00 PM ET"`
- `"1st Wednesday (learning) | 3rd Thursday (social) | Evenings"`

---

### day (optional)
**Type:** string  
**Purpose:** easy scanning/filtering for day(s) of week.

**Acceptable examples**
- `"Tuesday"`
- `"Wednesday"`
- `"Wednesday | Thursday"`
- `"Varies"`

---

### venue (recommended)
**Type:** string

**Examples**
- `"Union Jack Pub"`
- `"St. Matthews-Eline Branch Library"`
- `"Varies"`
- `"Private location"`

---

### address (recommended)
**Type:** string  
**Purpose:** shown in popup; used for a Google Maps link.

**Examples**
- `"921 Broad Ripple Ave, Indianapolis, IN 46220"`
- `"Grand Rapids, MI"`
- `"Private location (see organizer)"`

---

### city (recommended)
**Type:** string  
**Purpose:** physical location label (what city the meetup is held in).

**Examples**
- `"Indianapolis"`
- `"Covington"`
- `"St. Louis"`

---

### county (optional)
**Type:** string  
**Purpose:** informational.

**Examples**
- `"Marion"`
- `"Kenton"`
- `"St. Louis City"`

---

### zip (optional)
**Type:** string  
**Purpose:** informational. (May be empty if location varies.)

**Examples**
- `"46220"`
- `"41011"`
- `""`

---

## State fields

### state_code (required)
**Type:** string  
**Purpose:** physical state where the meetup occurs (2-letter US code).

**Rules**
- Must be exactly 2 letters, uppercase.
- Examples: `IN`, `IL`, `KY`, `MI`, `OH`, `MO`

**Example**
```json
"state_code": "IN"
```

### state_name (required)
**Type:** string  
**Purpose:** full state name for readability/search.

**Examples**
- `"Indiana"`
- `"Illinois"`
- `"Kentucky"`
- `"Michigan"`
- `"Ohio"`
- `"Missouri"`

---

### states (required)
**Type:** array of strings  
**Purpose:** search/coverage states. Use this when a meetup is relevant to more than one state (border/metro areas).

**Rules**
- Must include the physical `state_code`.
- Add additional states only if the meetup is meaningfully relevant across the border.
  - Example: meetup held in KY but serves Cincinnati OH area → include `["KY","OH"]`.
- Use 2-letter uppercase codes only.
- Keep order simple (usually physical state first).

**Examples**
Indiana meetup (normal):
```json
"states": ["IN"]
```

Border meetup:
```json
"state_code": "KY",
"state_name": "Kentucky",
"states": ["KY", "OH"]
```

---

## City coverage / aliases

### cities (required)
**Type:** array of strings  
**Purpose:** improves search so users can find meetups by nearby major cities (especially metro/border areas).

**Rules**
- Should list the **10 largest cities in approximately a 25 mile radius**.
  - Approximate is OK—use good judgment.
  - Include the physical `city` (where the meetup is held).
- Sort the array **alphabetically**.
- Strings only (no objects).

**Example**
```json
"cities": [
  "Avon",
  "Brownsburg",
  "Carmel",
  "Fishers",
  "Greenwood",
  "Indianapolis",
  "Noblesville",
  "Plainfield",
  "Speedway",
  "Westfield"
]
```

---

## Coordinates

### lat (required)
**Type:** number  
**Purpose:** marker placement.

**Rules**
- Must be a number (not a string).
- Use **at least 8 decimal places** for precision.

**Example**
```json
"lat": 39.86952676
```

### lon (required)
**Type:** number  
**Purpose:** marker placement.

**Rules**
- Must be a number (not a string).
- Use **at least 8 decimal places** for precision.
- Note: west longitudes in the US are negative.

**Example**
```json
"lon": -86.14215650
```

---

## links (optional but recommended)
**Type:** array of objects  
**Purpose:** show clickable links in the popup.

**Rules**
- Links are optional.
- If present, keep them in this preferred order:
  1. dedicated website for the group
  2. meetup.com website
  3. linktree (or similar)
  4. X account
  5. Nostr account
  6. other

**Link object format**
```json
{
  "type": "meetup",
  "label": "meetup.com/indianapolis-bitcoin-meetup",
  "url": "https://www.meetup.com/indianapolis-bitcoin-meetup/"
}
```

**type acceptable examples**
- `"website"`
- `"meetup"`
- `"linktree"`
- `"x"`
- `"nostr"`
- `"other"`

(You can use other strings, but keep it short and lowercase.)

---

## notes (optional)
**Type:** string  
**Purpose:** short disclaimers, attendance estimates, “confirm with organizer,” etc.

**Examples**
- `"10 to 20 attend. Confirm details with the organizer."`
- `"Location varies. Check meetup.com for latest venue."`
```

---

# 4) `assets/data/meetups.example.json`
This is a single-entry example contributors can copy/paste.

```json
[
  {
    "id": "example-city-bitcoin-meetup",
    "name": "Example City Bitcoin Meetup",
    "frequency": "Monthly",
    "schedule": "Monthly | 2nd Tuesday | 6:30 PM ET",
    "day": "Tuesday",
    "venue": "Example Cafe",
    "address": "123 Main St, Example City, IN 46000",
    "city": "Example City",
    "county": "Example",
    "state": "IN",
    "state_code": "IN",
    "state_name": "Indiana",
    "states": ["IN"],
    "cities": [
      "Example City",
      "Nearby City A",
      "Nearby City B",
      "Nearby City C",
      "Nearby City D",
      "Nearby City E",
      "Nearby City F",
      "Nearby City G",
      "Nearby City H",
      "Nearby City I"
    ],
    "zip": "46000",
    "lat": 40.12345678,
    "lon": -86.12345678,
    "links": [
      { "type": "website", "label": "examplebitcoin.com", "url": "https://examplebitcoin.com" },
      { "type": "meetup", "label": "meetup.com/example-city-bitcoin", "url": "https://www.meetup.com/example-city-bitcoin" },
      { "type": "linktree", "label": "linktr.ee/examplebitcoin", "url": "https://linktr.ee/examplebitcoin" },
      { "type": "x", "label": "@examplebitcoin", "url": "https://x.com/examplebitcoin" },
      { "type": "nostr", "label": "npub…", "url": "https://primal.net/p/npub1..." }
    ],
    "notes": "Confirm details with the organizer."
  }
]
```
