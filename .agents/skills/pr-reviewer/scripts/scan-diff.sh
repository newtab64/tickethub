#!/usr/bin/env bash
# ==============================================================================
# Script: scan-diff.sh
# Description: Performs static analysis on newly added lines (+) in a PR diff
#              to detect forbidden characters, mock code, and quality issues.
# ==============================================================================

set -euo pipefail

export LC_ALL=C.UTF-8
export LANG=C.UTF-8

PR_NUMBER="${1:-}"

if [ -z "$PR_NUMBER" ]; then
  echo "Usage: $0 <PR_NUMBER>"
  echo "Example: $0 15"
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

DIFF_FILE="$TMP_DIR/pr-$PR_NUMBER.diff"
ADDED_LINES_FILE="$TMP_DIR/added_lines.txt"
FRONTEND_ADDED_LINES_FILE="$TMP_DIR/frontend_added_lines.txt"

# 1. Fetch diff via GitHub CLI
gh pr diff "$PR_NUMBER" > "$DIFF_FILE"

# 2. Extract added lines (+), skipping diff headers (+++)
grep -E '^\+[^+]' "$DIFF_FILE" > "$ADDED_LINES_FILE" || true

# 3. Extract added lines specifically for frontend files (apps/web)
awk '
  /^diff --git a\/apps\/web/ { in_web = 1; next }
  /^diff --git a\// { in_web = 0; next }
  in_web && /^\+[^+]/ { print }
' "$DIFF_FILE" > "$FRONTEND_ADDED_LINES_FILE" || true

echo "======================================================================"
echo "STATIC DIFF SCAN RESULTS FOR PULL REQUEST #$PR_NUMBER"
echo "======================================================================"

# Check 1: Emoji characters
echo "[1] Scanning for Emoji characters:"
EMOJI_HITS=$(perl -CS -ne 'print if /\p{Extended_Pictographic}/' "$ADDED_LINES_FILE" || true)
if [ -n "$EMOJI_HITS" ]; then
  echo "WARNING: Detected emoji characters in newly added lines:"
  echo "$EMOJI_HITS" | head -n 10
else
  echo "OK: No emoji characters detected."
fi
echo ""

# Check 2: Forbidden dash characters (En-dash U+2013, Em-dash U+2014)
echo "[2] Scanning for forbidden dash characters (En-dash U+2013, Em-dash U+2014):"
DASH_HITS=$(perl -CS -ne 'print if /[\x{2013}\x{2014}]/' "$ADDED_LINES_FILE" || true)
if [ -n "$DASH_HITS" ]; then
  echo "WARNING: Detected forbidden dash characters:"
  echo "$DASH_HITS" | head -n 10
else
  echo "OK: No en-dash or em-dash characters detected."
fi
echo ""

# Check 3: Mock code leads (Client-side storage / Mock data / Fake tokens)
echo "[3] Scanning for client-side mocking leads (Requires contextual judgment):"
MOCK_HITS=$(grep -En "(localStorage|sessionStorage|mockData|fakeToken|dummyToken)" "$ADDED_LINES_FILE" || true)
if [ -n "$MOCK_HITS" ]; then
  echo "LEAD: Detected client storage keywords or mock data references:"
  echo "$MOCK_HITS" | head -n 10
  echo "Note: Reviewer must verify if this is fake auth token storage (Violation)"
  echo "or non-sensitive UI state persistence such as theme/sidebar (Acceptable)."
else
  echo "OK: No mock or client storage keywords detected."
fi
echo ""

# Check 4: Long setTimeout delays (Suspected fake network delay)
echo "[4] Scanning for setTimeout with delays >= 300ms:"
TIMEOUT_HITS=$(grep -En "setTimeout\([^,]+,\s*[3-9][0-9]{2,}\)" "$ADDED_LINES_FILE" || true)
if [ -n "$TIMEOUT_HITS" ]; then
  echo "LEAD: Detected setTimeout with delay of 300ms or higher:"
  echo "$TIMEOUT_HITS" | head -n 10
  echo "Note: Reviewer must verify whether this is for search debouncing (Acceptable)"
  echo "or faking network loading delays (Violation - TRASH_CODE)."
else
  echo "OK: No suspicious setTimeout calls detected."
fi
echo ""

# Check 5: Loose TypeScript casting and suppressions
echo "[5] Scanning for loose type casting (any) and TypeScript suppressions:"
TYPE_HITS=$(grep -En "(:\s*any\b|as\s+any\b|@ts-ignore|@ts-nocheck)" "$ADDED_LINES_FILE" || true)
if [ -n "$TYPE_HITS" ]; then
  echo "WARNING: Detected any casting or ts-ignore suppressions:"
  echo "$TYPE_HITS" | head -n 10
else
  echo "OK: No any casting or TypeScript suppressions detected."
fi
echo ""

# Check 6: Raw hex color codes in frontend (Design Tokens compliance)
echo "[6] Scanning for raw hex color codes in apps/web (Check docs/DESIGN_TOKENS.md):"
HEX_HITS=$(grep -En "#[0-9a-fA-F]{3,8}\b" "$FRONTEND_ADDED_LINES_FILE" || true)
if [ -n "$HEX_HITS" ]; then
  echo "LEAD: Detected hex color codes in frontend files:"
  echo "$HEX_HITS" | head -n 10
  echo "Note: If colors are inside third-party SVG icons, this may be acceptable."
  echo "Component styles must use CSS design tokens from docs/DESIGN_TOKENS.md."
else
  echo "OK: No raw hex colors detected in frontend code."
fi

echo "======================================================================"
echo "COMPLETED STATIC DIFF SCAN FOR PR #$PR_NUMBER"
echo "======================================================================"
