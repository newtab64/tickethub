# Pull Request Review Report (Internal - For Project Manager)

- **Pull Request:** #12 - feat(web): interactive zone seatmap and booking hold proxy (UC04)
- **Author:** @tranphuan68686868-lab
- **Branch:** `feat/w03-fe2-seatmap-interactive` into `unstable`
- **Checked Commit SHA:** `9f2b8a1c3e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a`
- **Business Context:** Use Case UC04 (Interactive Real-Time Seat Selection and Hold) in docs/system-design/03-use-cases.md
- **Verdict:** REQUEST_CHANGES

---

## 1. Summary & Verdict
This Pull Request implements the interactive zone seatmap and seat selection UI (UC04), along with Next.js Route Handler proxies to forward seat hold and release requests to the Fastify backend. The contributor completed the primary UI layout and most of the selection flow. However, the PR cannot be merged yet due to two Major issues: the booking hold proxy does not verify the user session or forward bearer authentication tokens to the backend, and the MiniMap component hardcodes coordinate bounds instead of deriving them from the SVG viewBox.

---

## 2. Factual Strengths
- **UI Architecture:** The SeatMap component is decomposed cleanly into modular components and uses interactive SVG rather than raw canvas, providing superior accessibility and responsive scaling.
- **Design Tokens Compliance:** All seat status classes (available, held, reserved, selected) strictly utilize CSS variables from docs/DESIGN_TOKENS.md (bg-primary, bg-muted, text-foreground), with zero arbitrary hex color codes.
- **Component Testing:** Added unit tests covering coordinate matrix calculations and seat status transitions in apps/web/test/seatmap.test.ts, with all 12 tests passing.

---

## 3. Severity Breakdown of Findings

### Severity: Blocker (Must be resolved before merging)
No Blocker issues found (No infrastructure tampering, no backend double-booking race condition).

### Severity: Major (Significant architectural or business logic defect)

- **Finding M1: Proxy route handler bypasses user session verification before holding seats**
  - **Location:** `apps/web/src/app/api/v1/booking/hold/route.ts:24` - [GitHub Permalink](https://github.com/newtab64/tickethub/blob/9f2b8a1c3e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a/apps/web/src/app/api/v1/booking/hold/route.ts#L24)
  - **Current Behavior:** The Route Handler takes the payload directly from the request body and forwards it to the Fastify backend without validating the Authorization header or session cookies.
  - **Expected Behavior:** Per docs/API_CONTRACT.md, POST /api/v1/booking/hold requires a valid BUYER role. The proxy must verify the session cookie or forward the Bearer token in the upstream request header.
  - **Production Impact:** Allows unauthenticated clients to trigger mass seat hold operations, resulting in inventory denial-of-service.

- **Finding M2: MiniMap component uses hardcoded dimensions instead of dynamic SVG viewBox**
  - **Location:** `apps/web/src/components/events/seat-map.tsx:185` - [GitHub Permalink](https://github.com/newtab64/tickethub/blob/9f2b8a1c3e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a/apps/web/src/components/events/seat-map.tsx#L185)
  - **Current Behavior:** The MiniMap computes viewport boundaries using fixed constants (width: 800, height: 600) rather than reading the SVG map viewBox attribute.
  - **Expected Behavior:** The MiniMap must scale dynamically according to the actual viewBox of the loaded venue SVG to support circular and rectangular stadium layouts.
  - **Production Impact:** For venues with aspect ratios differing from 4:3, the MiniMap indicator drifts away from the user actual viewport location.

### Severity: Minor (Code quality cleanup needed)
- **Finding N1:** Remove debug `console.log` at `apps/web/src/components/events/seat-map.tsx:92`.
- **Finding N2:** Unused variable `tempSelectedSeat` declared at `apps/web/src/components/events/seat-map.tsx:41`.

### Severity: Nit (Optional polish, non-blocking)
- **Suggestion 1:** Add JSDoc documentation explaining the zoom scale conversion formula at `seat-map.utils.ts:15`.

---

## 4. Visual Evidence & Anti-Tampering Check
- **Anti-Tampering Guard:** SECURE
  - No files under .github/workflows/**, scripts/pr-gate-*, or tests/pr-gate-* were modified.
- **UI Visual Evidence:** PASS
  - The PR modifies visual UI code in `apps/web/src/components/events/seat-map.tsx`.
  - The author attached a Loom video demonstration in Section 6 of the PR description illustrating seat selection and zoom/pan interactions. The video loads correctly and matches the code.

---

## 5. Technical Directives for Contributor
- [ ] **Requirement 1 (Proxy authentication):** Extract the session token from the user authentication context or cookie in the Next.js Route Handler and attach it to the upstream Authorization header. If unauthenticated, return HTTP 401 Unauthorized immediately.
- [ ] **Requirement 2 (Dynamic MiniMap):** Retrieve actual SVG dimensions via `getBoundingClientRect` or by parsing the root viewBox attribute rather than using fixed 800x600 constants.
- [ ] **Acceptance Criteria:**
  - POST /api/v1/booking/hold returns HTTP 401 when called without a valid session.
  - MiniMap viewport indicator remains aligned across various aspect ratios and zoom levels.
  - Remove debug console.log statements and unused variables.

---

## 6. Could Not Verify / Honest Limitations
- Could not verify pan/drag gesture smoothness on low-end Android mobile devices with weak GPU hardware, as testing was limited to desktop browsers and mobile emulation.
