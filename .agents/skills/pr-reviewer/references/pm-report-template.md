# Pull Request Review Report (Internal - For Project Manager)

- **Pull Request:** #[PR_NUMBER] - [PR_TITLE]
- **Author:** @[AUTHOR]
- **Branch:** `[HEAD_BRANCH]` into `[BASE_BRANCH]`
- **Checked Commit SHA:** `[HEAD_COMMIT_SHA]`
- **Business Context:** [Use Cases UC01 to UC12 in docs/system-design/03-use-cases.md]
- **Verdict:** [APPROVE | REQUEST_CHANGES | REJECT (SECURITY_VIOLATION) | REJECT (TRASH_CODE)]

---

## 1. Summary & Verdict
[Provide 2-3 objective paragraphs covering the PR objective, what the contributor implemented, how well it fulfills architectural requirements, and the rationale for the verdict.]

---

## 2. Factual Strengths
[Record verified strengths factually without diplomatic flattery.]
- **Architecture & Data:** [Example: Correctly used database transaction with SELECT ... FOR UPDATE or shared Zod schemas in packages/shared]
- **Testing:** [Example: Comprehensive integration tests added for new endpoints with full branch coverage]
- **UI & Design Tokens:** [Example: Component adheres strictly to design tokens, no hardcoded styles]

---

## 3. Severity Breakdown of Findings

### Severity: Blocker (Must be resolved before merging)
[Infrastructure tampering, mock auth/data on client, race conditions in ticket booking, security leaks, broken database transactions, API/ERD contract violations]

- **Finding B1:** [Short finding title]
  - **Location:** `[FILE_PATH]:[LINE_NUMBER]` - [GitHub Permalink](https://github.com/[OWNER]/[REPO]/blob/[HEAD_COMMIT_SHA]/[FILE_PATH]#L[LINE_NUMBER])
  - **Current Behavior:** [Describe what the code currently does and why it is wrong]
  - **Expected Behavior:** [Specify how the system must behave according to specifications]
  - **Production Impact:** [Concrete consequences: race condition, data corruption, outage, security vulnerability]

### Severity: Major (Significant architectural or business logic defect)
[Missing resource ownership checks, unvalidated input, missing negative test cases, responsive layout breakage, missing loading states]

- **Finding M1:** [Title]
  - **Location:** `[FILE_PATH]:[LINE_NUMBER]` - [GitHub Permalink](https://github.com/[OWNER]/[REPO]/blob/[HEAD_COMMIT_SHA]/[FILE_PATH]#L[LINE_NUMBER])
  - **Current Behavior:** [Description]
  - **Expected Behavior:** [Specification]
  - **Production Impact:** [Consequences]

### Severity: Minor (Code quality cleanup needed)
[Careless any type usage, dead code/unused imports, redundant console.log, unmapped hex colors]

- **Finding N1:** [Description with file:line location]

### Severity: Nit (Optional polish, non-blocking)
[Naming improvements, comment clarifications, formatting consistency]

- **Suggestion:** [Description]

---

## 4. Visual Evidence & Anti-Tampering Check
- **Anti-Tampering Guard:** [SECURE | VIOLATION]
  - Details: [No changes to protected infrastructure / Detected edits in: .github/workflows/**, scripts/pr-gate-*, tests/pr-gate-*]
- **UI Visual Evidence:** [PASS | FAIL | N/A]
  - UI File Status: [PR modifies visual UI in apps/web/src/** / PR only modifies backend or logic files]
  - Media Verification: [Images/videos verified and match code changes / Broken link / Missing media / Fraudulent N/A declaration]

---

## 5. Technical Directives for Contributor
[Provide architectural guidelines, pseudocode, function signatures, and acceptance criteria. STRICTLY NO COMPLETE DROP-IN CODE BLOCKS]
- [ ] **Directive 1:** [Technical requirement, pattern specification, link to docs/API_CONTRACT.md or docs/DATA_MODEL.md]
- [ ] **Directive 2:** [Concrete acceptance criteria for the contributor to verify]

---

## 6. Could Not Verify / Honest Limitations
[Parts of the PR that cannot be verified 100% via local inspection and must be monitored in staging/production]
- [Example: Sandbox webhook callback reliability from VNPay payment provider]
- [Example: High-concurrency throughput under 1000 requests/s on clustered Redis]
