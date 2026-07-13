# ProCal

ProCal is an electrical design and calculation assistant for low-voltage building projects. It helps engineers size transformers, generators, feeders, circuit breakers, and cables; coordinate protection selectivity; and produce project reports such as cable schedules, breaker schedules, MDB schedules, voltage-drop schedules, and single-line diagrams.

The application is built as a [Next.js](https://nextjs.org) web app with a local SQLite database. It is intended for design-office use where each project is owned by a registered user and persisted locally for fast offline work.

## Features

- Project-based design workflow with client, consultant, contractor, and location metadata.
- Building and floor modeling with apartments and service/mechanical loads.
- Apartment template editor with room-by-room load densities and AC sizing.
- Load library for lighting, sockets, AC units, pumps, elevators, and custom loads.
- Automatic sizing of:
  - Transformers (kVA)
  - Backup generators (kVA, considering motor starting surge)
  - Feeder breakers and cables
  - Panelboards (MDB, SMDB, distribution boards)
- Voltage-drop verification against IEC limits.
- Protection coordination checks for breaker selectivity.
- Report exports: cover page, cable schedule, breaker schedule, MDB schedule, voltage-drop schedule, and BOM.
- Country-specific defaults for voltage, frequency, power factor, room load densities, and AC sizing rules.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Runtime:** React 19, TypeScript 5
- **Styling:** Tailwind CSS 4
- **Database:** SQLite via Prisma ORM 7 (`better-sqlite3`)
- **Authentication:** JWT-based auth with `jose` and `bcryptjs`
- **Forms & Tables:** `react-hook-form`, `@tanstack/react-table`, `zod`
- **Printing / Reports:** `pagedjs`, `print-js`
- **Testing:** Vitest 3

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm (installed with Node.js)

### Installation

1. Clone the repository and open it in your terminal.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy or review the environment file:

   ```bash
   cp .env.example .env   # or simply use the existing .env
   ```

   The required variables are:

   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-secret-key"
   ```

4. Initialize the database and generate the Prisma client:

   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

   `prisma migrate dev` creates the SQLite file and schema based on `prisma/schema.prisma`.

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You can create an account, log in, and start a new electrical project.

### Available Scripts

```bash
npm run dev        # Start the Next.js development server
npm run build      # Build the production bundle
npm run start      # Start the production server
npm run lint       # Run ESLint
npm run test       # Run the Vitest test suite
npm run test:watch # Run Vitest in watch mode
```

## IEC Calculation Assumptions

ProCal performs low-voltage electrical sizing according to IEC 60364 series principles. The following assumptions and defaults are used unless overridden per project:

### System Defaults

- **Default country:** Syria
- **Line-to-line voltage:** 400 V (adjustable by country; e.g., 480 V for USA/Canada)
- **Frequency:** 50 Hz or 60 Hz depending on country
- **System power factor:** 0.85 for Middle Eastern defaults, 0.9 for most European/Oceanian defaults
- **Earthing system:** TN-S by default
- **Max demand factor:** 0.8 at project level

### Demand & Diversity

- **Apartment diversity:** Applied per IEC 60439 / common residential practice based on the number of apartments:
  - 1 apartment: 1.0
  - 2–4 apartments: 0.8
  - 5–9 apartments: 0.7
  - 10–14 apartments: 0.6
  - 15–19 apartments: 0.55
  - 20+ apartments: 0.5
- **Individual load library demand factors:** configurable per item (default 1.0)
- **Project max demand factor:** configurable; defaults to 0.8

### Cable Sizing Method

Cable and breaker sizing follows IEC 60364-5-52 and IEC 60364-5-54:

1. **Design current** (`Ib`) is calculated from the connected load and power factor.
2. **Breaker rating** (`In`) is the next standard rating ≥ `Ib`.
3. **Cable ampacity** (`Iz`) is selected from IEC tables per:
   - conductor material (copper or aluminum)
   - insulation (PVC or XLPE)
   - installation method (A1, A2, B1, B2, C, E, F, G)
   - phase count (1-phase or 3-phase)
4. **Derating factors** are applied:
   - ambient temperature derating (reference 30 °C)
   - grouping / bunching derating
5. The smallest cable with **derated ampacity ≥ breaker rating** is selected.
6. **Voltage drop** is checked against the limits below.
7. **Neutral and protective earth (PE)** sizes are sized per IEC 60364-5-54:
   - Copper phase ≤ 16 mm²: neutral and earth equal to phase size
   - Copper phase 16–35 mm²: earth = 16 mm², neutral may be reduced to ≥ 50 % of phase size
   - Copper phase > 35 mm²: earth ≈ 50 % of phase size (rounded up to standard size)

### Voltage Drop Limits (IEC 60364-5-52)

- **Lighting circuits:** 3 %
- **Power circuits:** 5 %

These limits are configurable per project but default to the IEC recommendations above.

### Installation Methods

Default installation method is **Method C** (cables clipped directly on a wall or surface). Other supported IEC methods:

- A1 / A2 – insulated conductors or multi-core cables in conduit in a thermally insulated wall
- B1 / B2 – insulated conductors or multi-core cables in conduit on a wooden or masonry wall
- C – clipped directly on a wall or surface (default)
- E – spaced from a wall or ceiling surface
- F – on perforated cable tray
- G – on ladder or insulators

### Short-Circuit Protection

- Short-circuit currents are calculated for three-phase faults.
- Breaker breaking capacities are checked against calculated fault levels where data is available.
- Protection selectivity is verified between upstream and downstream breaker families.

### Transformer & Generator Sizing

- Transformer size is selected from standard IEC utility ratings (100, 160, 250, 400, 630, … kVA) with a default 20 % safety margin.
- Generator size is selected from standard ratings and sized for continuous essential load plus the starting kVA surge of the largest motor (default starting factor 6.0, safety margin 1.1).

### Country Defaults

Country defaults bundle:

- supply voltage and frequency
- typical power factor
- room load densities (VA/m²) for kitchen, bedroom, living room, dining room, bathroom, hall, and other spaces
- AC sizing rules based on room area

Supported regions include the Middle East, North Africa, Europe, North America, South America, Asia, Oceania, Sub-Saharan Africa, and Central Asia. A fallback default config is used for countries not explicitly configured.

## Testing

```bash
npm run test
```

Tests cover cable sizing, voltage drop, current calculations, load aggregation, feeder sizing, selectivity, short-circuit calculations, country defaults, and single-line diagram generation.

---

Built with Next.js. See the [Next.js documentation](https://nextjs.org/docs) for deployment options.
