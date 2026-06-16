# TTB Label Verifier — Plan

A single-page, high-contrast, large-text internal tool that compares a label image to the application data using AI.

## Visual design

- Government navy + white theme. Single H1 "TTB Label Verifier" in the header.
- Body text ≥18px, labels/buttons ≥20px, headings 28–40px. Bold weights for primary content.
- Navy primary (`#1a2b5c`-ish, defined as oklch tokens in `src/styles.css`), white background, near-black text, high-contrast focus rings (4px), generous padding on inputs and buttons (≥56px tall).
- Two-column layout on desktop (`md:grid-cols-2`), stacked on mobile. Verify button full-width below both columns. Results area renders below.
- All colors via semantic tokens — no hardcoded color utilities.

## Page layout (single route: `/`)

```
┌──────────────────────────────────────────────┐
│ HEADER: TTB Label Verifier                   │
├──────────────────────────┬───────────────────┤
│ Application Data         │ Label Image       │
│  Brand Name       [____] │  ┌─────────────┐  │
│  Class/Type       [____] │  │ Drag & drop │  │
│  Alcohol (ABV)    [____] │  │  or click   │  │
│  Net Contents     [____] │  └─────────────┘  │
│                          │  [preview shown]  │
├──────────────────────────┴───────────────────┤
│        [  Verify Label  ]  (large)           │
├──────────────────────────────────────────────┤
│ Results area (empty until verified)          │
└──────────────────────────────────────────────┘
```

## Implementation

### Frontend (`src/routes/index.tsx`)
- Replace placeholder with the full single-page UI.
- State: form fields, uploaded file (`File`), preview data URL, loading, result.
- Upload zone: drag-and-drop + click-to-select, jpg/png only, single image, large clear preview after upload with a "Replace image" button.
- On submit: read image as base64 data URL, call the server function `verifyLabel`, render results.
- Set route `head()` with proper title/description.

### Results UI
- Overall verdict card (PASS / NEEDS REVIEW) with large icon-free text and color.
- Per-field checklist: Brand Name, Class/Type, ABV, Net Contents — each shows the value on the label (or "not found"), match status, and a plain-language note.
- General observations / required disclosures section.

### Backend (Lovable AI)
- Enable Lovable Cloud + ensure `LOVABLE_API_KEY`.
- `src/lib/verify-label.functions.ts` — `createServerFn` POST that takes `{ brandName, classType, abv, netContents, imageDataUrl }`, validates with Zod, calls Lovable AI Gateway via `/v1/chat/completions` using `google/gemini-2.5-pro` (strong multimodal reasoning) with a multimodal message (text + `image_url` data URL) and `response_format: json_object`. Returns structured `{ overall, fields: [...], notes: [...] }`.
- Handles 429 (rate limit) and 402 (credits) with clear error messages surfaced in the UI.
- Reads `LOVABLE_API_KEY` inside the handler; never exposed to client.

### Design tokens
- Update `src/styles.css`: navy primary, white background, strong focus ring token, larger default radius. Keep shadcn token mapping intact.

### Files touched
- `src/styles.css` — theme tokens
- `src/routes/index.tsx` — full page UI
- `src/lib/verify-label.functions.ts` — server function (new)
- `src/routes/__root.tsx` — update default title/meta to "TTB Label Verifier"

## Out of scope
- Auth, history/persistence of past verifications, multi-image uploads, PDF labels, exporting reports. Can be added later.
