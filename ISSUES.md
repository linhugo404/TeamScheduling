# Technical Debt & Issues Backlog

This document tracks known issues, improvements, and technical debt that need to be addressed.

**Last Updated:** January 7, 2026  
**Total Items:** 21 (18 completed)

---

## 🔴 Critical (Security)

### [x] XSS Vulnerabilities
**ID:** `xss-fix`  
**Priority:** Critical  
**Description:** 35 instances of `innerHTML` with user data, but only 1 use of `escapeHtml()`. User data from Azure AD (display names, etc.) is inserted directly into HTML without escaping.  
**Files Affected:** `locations.js`, `calendar.js`, `holidays.js`, `teams.js`, `bookings.js`, `azure-managers.js`, `socket.js`  
**Solution:** Add `escapeHtml()` wrapper to all user-provided data before inserting into innerHTML.

---

### [x] Missing HTTP Security Headers
**ID:** `security-headers`  
**Priority:** Critical  
**Description:** No security headers configured. Missing CSP, X-Frame-Options, HSTS, X-Content-Type-Options, etc.  
**Files Affected:** `server.js`  
**Solution:** Add Helmet middleware:
```javascript
const helmet = require('helmet');
app.use(helmet());
```

---

### [x] No Rate Limiting
**ID:** `rate-limiting`  
**Priority:** Critical  
**Description:** API endpoints have no rate limiting, making them vulnerable to abuse and DDoS.  
**Files Affected:** `server.js`  
**Solution:** Add express-rate-limit:
```javascript
const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

---

### [x] No Frontend Input Validation
**ID:** `input-validation`  
**Priority:** Critical  
**Status:** ✅ Completed  
**Description:** Data goes straight to API without validation. Relying solely on server-side validation.  
**Files Affected:** `api.js`, `bookings.js`, `teams.js`, `locations.js`  
**Solution:** Added `validation.js` with reusable validators for bookings, teams, and locations. Applied to all form submissions.

---

## 🟠 High (Stability/Accessibility)

### [x] Poor Accessibility (a11y)
**ID:** `accessibility`  
**Priority:** High  
**Status:** ✅ Completed  
**Description:** Only 1 aria attribute in entire HTML (906 lines). Missing aria-labels on icon buttons, role attributes on modals, aria-live for toasts, focus management, keyboard navigation for custom dropdowns.  
**Files Affected:** `index.html`, modal-related JS files  
**Solution:** Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to all modals. Added `aria-label` to close buttons. Added `aria-live="polite"` to toast container. Added `aria-hidden` to decorative SVGs.

---

### [x] Memory Leaks - Event Listeners
**ID:** `memory-leaks`  
**Priority:** High  
**Status:** ✅ Completed  
**Description:** 24 `addEventListener` calls but only 1 `removeEventListener`. Event listeners accumulate on view switches and calendar re-renders.  
**Files Affected:** `main.js`, `views.js`, `calendar.js`, `azure-managers.js`  
**Solution:** Created `event-manager.js` with tracked listeners, namespace support for bulk removal, and automatic cleanup on view switch via `cleanupView()`.

---

### [x] Inconsistent Error Handling
**ID:** `error-handling`  
**Priority:** High  
**Status:** ✅ Completed  
**Description:** Some functions throw errors, some return null, some log silently. No consistent pattern.  
**Files Affected:** `api.js`, `auth.js`, all route files  
**Solution:** Created `errors.js` with `AppError` class, `ErrorCodes` enum, and `handleError()` utility for consistent error handling.

---

### [x] No Request Timeout/Retry
**ID:** `request-timeout`  
**Priority:** High  
**Status:** ✅ Completed  
**Description:** Fetch calls have no timeout. If server hangs, UI hangs forever.  
**Files Affected:** `api.js`, `auth.js`  
**Solution:** Added `fetch-utils.js` with `fetchWithRetry()` - 10s timeout, 2 retries with exponential backoff. All API calls now use this wrapper.

---

### [x] Date Handling Without Timezone Awareness
**ID:** `timezone-handling`  
**Priority:** High  
**Status:** ✅ Completed  
**Description:** Using `new Date().toISOString().split('T')[0]` can give wrong date near midnight depending on user's timezone.  
**Files Affected:** `utils.js`, `calendar.js`, `bookings.js`, route files  
**Solution:** Created `date-utils.js` with `formatLocalDate()`, `parseLocalDate()`, `getLocalToday()` - all timezone-aware. Updated `utils.js` to use these functions.

---

## 🟡 Medium (Performance/Quality)

### [x] Synchronous Script Loading
**ID:** `async-scripts`  
**Priority:** Medium  
**Description:** External scripts block rendering. MSAL library loads synchronously.  
**Files Affected:** `index.html`  
**Solution:** Add `async` or `defer` to script tags:
```html
<script defer src="https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js"></script>
```

---

### [x] 104 Console Logs in Production
**ID:** `console-logs`  
**Priority:** Medium  
**Description:** Console.log/error/warn found in 21 files. Should not be in production.  
**Files Affected:** All JS files  
**Solution:** Either:
1. Strip console.* in build process
2. Use environment-aware logger:
```javascript
const log = process.env.NODE_ENV === 'production' ? () => {} : console.log;
```

---

### [x] Missing Loading States
**ID:** `loading-states`  
**Priority:** Medium  
**Status:** ✅ Completed  
**Description:** Only drag-drop has loading animation. Save/delete operations have no visual feedback.  
**Files Affected:** `bookings.js`, `teams.js`, `locations.js`  
**Solution:** Added `loading.js` with `setButtonLoading()` utility. All form submit buttons now show spinner and "Saving..." text during async operations.

---

### [x] Hardcoded Default Location
**ID:** `hardcoded-location`  
**Priority:** Medium  
**Description:** `state.js` has `currentLocation: 'jhb'` hardcoded. Will break if this location is deleted.  
**Files Affected:** `state.js`  
**Solution:** Default to first available location or null, handle gracefully.

---

### [x] Hardcoded Configuration Values
**ID:** `env-config`  
**Priority:** Medium  
**Status:** ✅ Completed  
**Description:** Values like cache TTL (5 min), static file maxAge (1h), debounce delays are hardcoded.  
**Files Affected:** `state.js`, `server.js`, `main.js`  
**Solution:** Created `config.js` with API_CONFIG, CACHE_CONFIG, UI_CONFIG, FEATURES, and LIMITS. Updated `state.js`, `fetch-utils.js`, `utils.js` to use config values.

---

## 🟢 Low (Tooling/Cleanup)

### [x] No ESLint/Prettier
**ID:** `eslint-prettier`  
**Priority:** Low  
**Description:** No linting or formatting configuration. Code style not enforced.  
**Solution:** Add `.eslintrc.json` and `.prettierrc`:
```json
{
  "extends": ["eslint:recommended"],
  "env": { "browser": true, "node": true, "es2021": true }
}
```

---

### [x] Missing npm Scripts
**ID:** `package-scripts`  
**Priority:** Low  
**Description:** Only `start` and `dev` scripts exist. Missing lint, test, build, format.  
**Files Affected:** `package.json`  
**Solution:** Add scripts:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "jest",
    "format": "prettier --write ."
  }
}
```

---

### [ ] No Unit Tests
**ID:** `unit-tests`  
**Priority:** Low  
**Description:** Zero test coverage. No unit tests, integration tests, or E2E tests.  
**Solution:** Add Jest for backend API tests, consider Playwright for E2E.

---

### [ ] CSS Duplication
**ID:** `css-cleanup`  
**Priority:** Low  
**Description:** `styles.css` is 4712 lines with some duplication. Media queries scattered throughout.  
**Files Affected:** `styles.css`  
**Solution:** Consolidate media queries, remove duplicates, consider CSS modules or SCSS.

---

### [x] Missing Favicon
**ID:** `favicon`  
**Priority:** Low  
**Description:** No favicon configured. Browser shows default icon.  
**Files Affected:** `index.html`  
**Solution:** Add favicon:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
```

---

### [x] No Graceful Degradation
**ID:** `graceful-degradation`  
**Priority:** Low  
**Description:** If JavaScript fails to load, user sees blank page with no explanation.  
**Files Affected:** `index.html`  
**Solution:** Add noscript tag:
```html
<noscript>
  <div class="no-js-message">
    JavaScript is required to use this application.
  </div>
</noscript>
```

---

## 🔵 Future Consideration

### [ ] TypeScript Migration
**ID:** `typescript`  
**Priority:** Future  
**Description:** Vanilla JavaScript provides no type safety. TypeScript would catch bugs at compile time.  
**Solution:** Gradual migration starting with new files, add `tsconfig.json`, rename files to `.ts`.

---

## Progress Tracking

| Priority | Total | Completed | Remaining |
|----------|-------|-----------|-----------|
| 🔴 Critical | 4 | 4 | 0 |
| 🟠 High | 5 | 5 | 0 |
| 🟡 Medium | 5 | 5 | 0 |
| 🟢 Low | 6 | 4 | 2 |
| 🔵 Future | 1 | 0 | 1 |
| **Total** | **21** | **18** | **3** |

---

## How to Use This Document

1. Pick an item from the highest priority section that hasn't been completed
2. Mark it as `[x]` when complete
3. Update the Progress Tracking table
4. Commit with message referencing the issue ID (e.g., `fix: XSS vulnerabilities [xss-fix]`)

