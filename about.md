# AAI Global Kit Generator (Ad Localizer)

**AAI Global Kit Generator** is a full-stack web application designed to scale localized marketing assets from a single master advertisement image. Using server-side **Gemini 3.1 Flash Image** (`gemini-3.1-flash-image-preview`) generation, it translates on-image copy into the primary language of selected target countries while preserving the original composition, typography style, colors, and visual elements.

---

## Core Functions & Capabilities

### 1. Master Creative Upload
- Supports **drag-and-drop**, click-to-browse, and keyboard activation (`Enter` / `Space`) for **JPEG, PNG, and WebP** image files (`image/jpeg`, `image/png`, `image/webp`) up to **20 MB**.
- Reads pixel dimensions (`W×H`), file size, and MIME type in the browser and renders a crisp preview card with quick file replacement.

### 2. Multi-Market Target Selection & Regional Presets
- Includes one-click regional preset bundles (**DACH**, **APAC Key**, **LATAM**, **Nordics**) plus a searchable autocomplete combobox populated with an ISO 3166-1 list of **195 countries**.
- Supports full keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`), removable market tags, and batch clearing.

### 3. Aspect Ratio Configuration
- Visual aspect ratio selector with proportional wireframe SVG frames for five supported ratios:
  - `16:9` (default)
  - `1:1`
  - `9:16`
  - `4:3`
  - `3:4`
- Dynamically updates the studio canvas framing preview before generation and enforces the selected aspect ratio in `imageConfig.aspectRatio`.

### 4. Concurrent Localization, Filtering & Split Comparison
- Dispatches parallel `POST /api/generate` requests across all selected markets via `Promise.all` with `AbortController` cancellation support.
- Tracks live batch progress (`completed / total`), elapsed generation timer, and per-market duration.
- Provides segmented status filter tabs (**All**, **Ready**, **Pending**, **Failed**), **Grid / List** layout switching, and per-card **Retry** for failed markets.
- Includes an interactive **Before / After Comparison Modal** with a draggable vertical split slider and keyboard navigation (`ArrowLeft`, `ArrowRight`, `Escape`).

### 5. Theme Toggle, Asset Export & Campaign Reset
- **Light / Dark Theme Toggle**: Switches between a cool Mineral Slate & Verdigris Teal light theme and an obsidian dark theme, persisted in `localStorage` without flash on reload.
- **Per-Asset & Batch Export**: Download individual localized creatives in their returned format (`.jpg`, `.png`, or `.webp` as `localized_ad_<market>.<ext>`) or trigger staggered **Export All** downloads.
- **Reset (`New Campaign`)**: Aborts any in-flight generation requests and resets inputs and results.

### 6. Server-Side API & Health Endpoint
- `GET /api/health` — Returns `{ "status": "ok" }` for service health checks.
- `POST /api/generate` — Validates `market` (against the 195-country allowlist), `refImage` (Base64), `mimeType` (`image/jpeg`, `image/png`, `image/webp`), and `ratio` (`16:9`, `1:1`, `9:16`, `4:3`, `3:4`), reads `GEMINI_API_KEY` (or `API_KEY`) from server environment variables, invokes `gemini-3.1-flash-image-preview`, and returns `{ "base64Image": "...", "mimeType": "..." }`.

---

## Tech Stack

| Layer | Technology | Version / Details |
| :--- | :--- | :--- |
| **Frontend** | Vanilla TypeScript (Zero-React DOM Architecture) | Strict TypeScript `~5.8.2` |
| **Typography** | Bricolage Grotesque, Plus Jakarta Sans, JetBrains Mono | Tabular numerals (`tabular-nums`) |
| **Styling** | Tailwind CSS (`@tailwindcss/vite`, `tailwindcss`) | `^4.2.1` (`@custom-variant dark`) |
| **Icons** | Custom inline geometric SVG icon library (`src/icons.ts`) | Zero external icon dependencies |
| **Backend** | Express | `^4.21.2` |
| **AI SDK & Model** | `@google/genai` (`gemini-3.1-flash-image-preview`) | `^1.29.0` |
| **Dev & Bundling** | Vite (`^6.2.0`), `tsx` (`^4.21.0`), `esbuild` (`^0.28.0`) | Node `@types/node` `^22.14.0` |

### Architecture Overview
- **Development Mode**: `tsx server.ts` starts an Express server on port `3000` (or `process.env.PORT`) with Vite middleware mounted in SPA mode.
- **Production Mode**: `npm run build` compiles the Vite client bundle into `dist/` and bundles `server.ts` with `esbuild` into `dist/server.cjs`. `npm start` serves the static frontend and API routes from Express.

---

## User Instructions

### Using the Application
1. **Upload Master Creative**:
   - Drag and drop a JPEG, PNG, or WebP ad image into **1. Master Creative** (or click/press `Enter` to browse).
   - Inspect the file dimensions and size metadata, or click **Replace file** to swap creatives.
2. **Select Target Markets**:
   - Click regional preset buttons (`+ DACH`, `+ APAC Key`, `+ LATAM`, `+ Nordics`) or search the 195-country list in **2. Target Markets** (`ArrowUp`/`ArrowDown` + `Enter` or click to add).
3. **Choose Output Aspect Ratio**:
   - Select `16:9`, `1:1`, `9:16`, `4:3`, or `3:4` under **3. Output Aspect Ratio**.
4. **Localize & Inspect**:
   - Click **Localize Markets** to generate assets concurrently. Monitor real-time progress, filter by status, switch between Grid and List layouts, or retry any failed market.
   - Click **Compare** (or click any generated image) to open the **Before / After** split comparison slider.
5. **Download, Switch Theme & Start Over**:
   - Toggle **Light / Dark** mode from the top header bar.
   - Download individual assets or click **Export All** in the results toolbar; click **New Campaign** in the header to reset.

### Running Locally (Developers)
1. **Configure Environment Variable**:
   - Set `GEMINI_API_KEY` in your environment (or project secrets) with a valid Gemini API key.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.
4. **Type-Check & Production Build**:
   ```bash
   npm run lint
   npm run build
   npm start
   ```
