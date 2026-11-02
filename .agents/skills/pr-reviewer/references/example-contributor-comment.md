### Code Review Feedback

Hi @tranphuan68686868-lab, thank you for contributing the Interactive Seatmap and Booking Hold Proxy (UC04) feature to TicketHub.

Your SVG seatmap architecture and styling look great, strictly follow the color design tokens, and include a helpful demonstration video. Before we can merge this PR into unstable, there are two important business and security items that need adjustment:

---

#### 1. General Verification Status
- **Local Technical Checks:** 12/12 frontend unit tests passed (PASS).
- **Visual Evidence:** Loom video demonstrates the interactive flow clearly.
- **Architectural Compliance:** Action required on proxy session verification and dynamic MiniMap scaling.

---

#### 2. Actionable Adjustments Required Before Merge

##### Item 1: Verify user session before forwarding seat hold requests
- **Location:** `apps/web/src/app/api/v1/booking/hold/route.ts:24` ([View on GitHub](https://github.com/newtab64/tickethub/blob/9f2b8a1c3e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a/apps/web/src/app/api/v1/booking/hold/route.ts#L24))
- **Current Behavior & Risk:** The Route Handler currently forwards the request directly to the backend without verifying if the user is authenticated. This could allow unauthenticated users to hold seats and exhaust event inventory.
- **Technical Requirement:** Extract the session token from the authentication context or cookies and attach it as a Bearer token in the Authorization header. If the user is unauthenticated, respond with HTTP 401 Unauthorized directly at the proxy layer.
- **Acceptance Criteria:** Calling the hold endpoint without an active session returns HTTP 401.

##### Item 2: Synchronize MiniMap scale dynamically with SVG viewBox
- **Location:** `apps/web/src/components/events/seat-map.tsx:185` ([View on GitHub](https://github.com/newtab64/tickethub/blob/9f2b8a1c3e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a/apps/web/src/components/events/seat-map.tsx#L185))
- **Current Behavior & Risk:** The MiniMap uses fixed dimensions (800x600) for scale calculations, causing the viewport indicator to drift on venue maps with different aspect ratios.
- **Technical Requirement:** Calculate the scaling factor dynamically using the SVG map root viewBox or bounding rectangle.
- **Acceptance Criteria:** The MiniMap indicator remains aligned with the active viewport across different screen sizes and aspect ratios.

---

#### 3. Minor Cleanups & Optimizations (Minor & Nit)
- `apps/web/src/components/events/seat-map.tsx:92`: Remove debug `console.log`.
- `apps/web/src/components/events/seat-map.tsx:41`: Remove unused variable `tempSelectedSeat`.

---

#### 4. Technical Guidance & References
Please reference the architecture documentation:
- Use Case Specs: `docs/system-design/03-use-cases.md` (Section UC04)
- API Contract: `docs/API_CONTRACT.md` (Booking Endpoints)

Once you have updated the branch and pushed your changes, please drop a comment here so we can re-verify. Thanks for your hard work!
