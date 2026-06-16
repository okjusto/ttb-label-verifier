# TTB Label Verifier

An AI-powered prototype that helps alcohol-beverage compliance agents verify label artwork against application data. Built as a standalone proof-of-concept in response to the TTB Label Compliance discovery brief.

> **About this project** — Built by Justo Garcia as a take-home for an employment evaluation. Shared for review purposes; happy to discuss licensing or reuse if it's useful beyond the evaluation.

---

## What it does

A compliance agent uploads a photo of an alcohol-beverage label and (in single mode) enters the corresponding application data. The app uses a vision-capable AI model to read the label, then compares each field against the application and returns a clear, color-coded compliance report.

It is designed around the realities surfaced in the stakeholder interviews:

- **Fast** — verification targets sub-5-second turnaround, the threshold below which agents abandon the tool (a lesson from the failed scanning-vendor pilot).
- **Simple** — a single, high-contrast screen with large controls, usable by agents across a wide range of tech comfort.
- **Forgiving of imperfect images** — angled, glare-heavy, or poorly lit photos are handled by the model rather than auto-rejected.
- **Aware of nuance** — cosmetic differences (e.g. `STONE'S THROW` vs `Stone's Throw`) are flagged for human review, not hard-rejected.
- **Strict where it must be** — the mandatory Government Health Warning is checked for exact wording and required formatting (all-caps, bold "GOVERNMENT WARNING:").
- **Batch-capable** — supports bulk uploads for the peak-season importer dumps of 200–300 labels.

---

## Core features

### Single-label verification
- Agent enters application data: Brand Name, Class/Type, Alcohol Content, Net Contents.
- Agent uploads one label image.
- Each field returns one of three states:
  - **Match** — values are equivalent.
  - **Review** — values differ only cosmetically (capitalization, punctuation, spacing); both shown side by side for the agent's final call.
  - **Mismatch** — values are substantively different.
- The Government Warning gets a dedicated check: pass only when the exact wording is present **and** "GOVERNMENT WARNING:" is all-caps **and** bold. Formatting-only problems return a reviewable warning rather than a silent pass.
- Image-quality feedback: a non-blocking notice for poor images, and a clear "please re-shoot" message for unreadable ones.

### Batch verification
- Upload many labels at once (designed for 200+).
- Each label is read and summarized in a results table: thumbnail, extracted brand, ABV, net contents, warning status, and image quality.
- Visible queue progress ("Processing 14 of 312").
- Click any row for full detail.

---

## Architecture

```
Browser (React UI)
      │  image (base64) + application data
      ▼
Backend function  ──►  Vision AI model  ──►  structured JSON
      │                                         { extracted, warningChecks, imageQuality }
      ▼
Browser renders color-coded compliance report
```

The AI call runs server-side, never in the browser. This keeps credentials off the client and is the pattern a real deployment would use.

**Why a server-side model call:** browser-side AI calls would expose API credentials and are blocked at the provider origin. A thin backend function holds the secret, receives the image and form data, calls the model, and returns parsed JSON.

---

## Tech stack

- **Frontend:** React + TypeScript (built in Lovable)
- **Backend:** Managed serverless function (Lovable Cloud / Supabase edge function)
- **AI model:** Claude Sonnet (vision) — chosen for reliable reading of imperfect images
- **Hosting:** Deployed via Lovable; source synced to GitHub

---

## Setup & run

This project was built and deployed through Lovable, with source synced to GitHub for inspection.

### View the deployed app
Visit the deployed URL: **[add your deployed URL here]**

### Run locally
1. Clone the repository:
   ```bash
   git clone [your-repo-url]
   cd ttb-label-verifier
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment. Copy `.env.example` to `.env` and provide:
   - The backend connection values (provisioned by Lovable Cloud / Supabase).
   - The AI model credential, stored as a backend secret — **never committed**.
4. Start the dev server:
   ```bash
   npm run dev
   ```

> The AI credential lives only as a server-side secret. It is not present in this repository and is not exposed to the browser.

---

## Approach & decisions

- **Model over raw OCR.** A reasoning vision model handles glare, angles, and poor lighting far better than traditional OCR, and it can make the equivalence judgments ("same brand, different capitalization") that the interviews flagged as essential. This directly addresses the agents' two biggest pain points: imperfect images and trivial-mismatch false rejects.
- **Three-state results, not pass/fail.** A hard binary would recreate the over-rejection problem agents described. The "Review" state keeps a human in the loop exactly where judgment is needed.
- **Strict warning check.** Because the Government Warning is a legal requirement and a common evasion target, it is checked separately for both wording and formatting, with the mandatory text supplied to the model rather than recalled, so the word-for-word comparison is reliable.
- **Speed-first.** Prompts request only the needed fields as compact JSON (no explanatory prose) to keep latency under the 5-second threshold. The model is swappable for a faster variant if latency becomes binding.

---

## Assumptions

- **Standalone prototype.** No integration with the COLA system; per the IT stakeholder, that carries separate authorization requirements and is out of scope.
- **No sensitive-data storage.** The prototype does not persist PII or label documents beyond what a session requires. A production deployment would need to address federal retention and PII policies.
- **Cloud AI access.** The firewall constraint raised in interviews applies to the agency's internal deployment environment, not to this hosted prototype. A production rollout would route the model call through an approved internal endpoint.
- **Government warning text** is treated as the standard mandatory TTB wording; beverage-type-specific exceptions (e.g. certain ABV-labeling exemptions) are noted but not exhaustively encoded.

---

## Trade-offs & limitations

- **Model latency vs. accuracy.** Sonnet was chosen for accuracy on poor images; a faster variant would trim latency at some cost to reliability on hard photos.
- **Batch concurrency** is deliberately throttled to protect the backend; very large batches process steadily rather than all at once.
- **Field coverage** focuses on the core verifiable fields (brand, class/type, ABV, net contents, warning). Producer/bottler address and country-of-origin checks are natural next additions.
- **No persistence layer.** Results are session-scoped; an audit trail and history would be required for production.

---

## Possible next steps

- COLA workflow integration once authorization scope is defined.
- Audit logging and result history for traceability.
- Additional field checks (address, country of origin, net-contents format rules by beverage type).
- Role-based access and an internal approved AI endpoint for the agency network.

---

## License & ownership

© 2026 Justo Garcia. Provided for evaluation and review. Copyright in the code and accompanying materials remains with the author unless otherwise agreed in writing.

---

© 2026 Justo Garcia · Author/Designer
