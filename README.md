# 🏢 Office Booking System

A modern, real-time web application for managing office space bookings, team schedules, and desk reservations with interactive floor plans and Azure AD integration.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Azure AD](https://img.shields.io/badge/Azure%20AD-SSO-0078D4?logo=microsoft&logoColor=white)](https://azure.microsoft.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Test Coverage](https://img.shields.io/badge/Coverage-95%25-brightgreen)](coverage/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Azure AD Setup](#-azure-ad-setup)
- [Development](#-development)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## ✨ Features

### 🔐 Authentication & Security
- **Azure AD Single Sign-On** — Sign in with Microsoft work accounts
- **JWT Token Validation** — Backend verifies Azure AD tokens via JWKS
- **Role-based Access** — Configurable team lead job titles
- **Rate Limiting** — 200 requests per 15 minutes per IP
- **Security Headers** — Full CSP, HSTS, X-Frame-Options via Helmet
- **XSS Protection** — HTML escaping on all user-generated content

### 📅 Team Scheduling
- **Interactive Calendar** — Visual monthly grid with drag-and-drop rescheduling
- **Multi-Location Support** — Multiple offices with addresses and maps
- **Team Management** — Manager photos, member counts, custom colors
- **Capacity Tracking** — Real-time warnings when approaching limits
- **Public Holidays** — Auto-fetch South African holidays from Nager.Date API
- **Weather Forecast** — 7-day forecast using Open-Meteo API
- **Calendar Export** — ICS files for Outlook, Google Calendar, Apple Calendar

### 🪑 Desk Booking & Floor Plans
- **Visual Floor Plan Editor** — Drag-and-drop layout designer
- **Room Elements** — Labeled boundaries with custom colors
- **Desk Types** — Hotseat (anyone), Team Seat (reserved), Unavailable
- **Time Slider** — Preview occupancy at any time of day
- **QR Code Check-In** — Scan desk QR codes to confirm arrival
- **Multi-Floor Support** — Switch between floors per location

### 🔄 Real-Time Collaboration
- **Live Presence** — See who's viewing the same calendar
- **Instant Sync** — Bookings update across all clients via Socket.IO
- **Optimistic Updates** — Immediate UI feedback before server confirms

### 🎨 User Experience
- **Dark/Light Theme** — Auto-detects system preference with manual toggle
- **Responsive Design** — Desktop grid, mobile list, tablet-optimized
- **Keyboard Shortcuts** — Arrow keys for month navigation
- **Blueprint Floor Plans** — Professional architectural visualization
- **Accessibility** — ARIA labels, roles, live regions, semantic HTML

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | Runtime |
| [npm](https://www.npmjs.com/) | 9+ | Package manager |
| [Supabase](https://supabase.com/) | Free tier | PostgreSQL database |
| [Azure AD](https://portal.azure.com/) | Any tenant | Authentication |

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/office-booking.git
cd office-booking

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials (see Configuration section)

# Initialize database
# Run the contents of supabase-schema.sql in Supabase SQL Editor

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key

# Azure AD (Required for authentication)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_TENANT_ID=your-tenant-id

# Server (Optional)
PORT=3000
NODE_ENV=development
```

| Variable | Required | Description |
|----------|:--------:|-------------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase service role key (not anon key) |
| `AZURE_AD_CLIENT_ID` | ✅ | Azure AD Application (client) ID |
| `AZURE_AD_TENANT_ID` | ✅ | Azure AD Directory (tenant) ID |
| `PORT` | ❌ | Server port (default: 3000) |
| `NODE_ENV` | ❌ | `development` or `production` |

> ⚠️ **Security Note:** Never commit `.env` to version control. It's already in `.gitignore`.

---

## 🔑 Azure AD Setup

### Step 1: Register Application

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
2. Click **+ New registration**
3. Configure:
   - **Name:** `Office Booking System`
   - **Supported account types:** Single tenant
   - **Redirect URI:** Select **Single-page application (SPA)** and enter:
     - `http://localhost:3000` (for local development)

### Step 2: Configure Redirect URIs

After registration, go to **Authentication** and add all environments:

| Environment | Redirect URI |
|-------------|--------------|
| Local | `http://localhost:3000` |
| Production | `https://your-app.onrender.com` |
| Custom Domain | `https://booking.yourcompany.com` |

> **Important:** The redirect URI must match your actual domain exactly.

### Step 3: API Permissions

Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**:

| Permission | Purpose |
|------------|---------|
| `openid` | OpenID Connect sign-in |
| `profile` | Read user profile |
| `email` | Read user email |
| `User.Read` | Read signed-in user's profile |
| `User.Read.All` | List users for manager selection |
| `Directory.Read.All` | Get direct reports count |

Click **Grant admin consent for [your tenant]**.

### Step 4: Copy Credentials

From the **Overview** page, copy:
- **Application (client) ID** → `AZURE_AD_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`

---

## 💻 Development

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Check code style with ESLint |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without changes |

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode during development
npm run test:watch
```

**Current Coverage:** 95%+ across 161 tests

### Code Quality

```bash
# Check linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` or `A` | Previous month |
| `→` or `D` | Next month |

---

## 🏗️ Architecture

### Project Structure

```
office-booking/
├── server.js                 # Express server entry point
├── package.json              # Dependencies and scripts
├── jest.config.js            # Test configuration
├── .eslintrc.json            # ESLint configuration
├── .prettierrc               # Prettier configuration
├── render.yaml               # Render deployment config
├── supabase-schema.sql       # Database schema
│
├── config/
│   └── supabase.js           # Supabase client initialization
│
├── middleware/
│   ├── index.js              # Middleware exports
│   ├── auth.js               # JWT verification (JWKS)
│   └── requireAuth.js        # Route protection
│
├── routes/
│   ├── index.js              # Route exports
│   ├── auth.js               # Authentication config endpoint
│   ├── data.js               # Initial data load
│   ├── bookings.js           # Team booking CRUD
│   ├── locations.js          # Location management
│   ├── teams.js              # Team management
│   ├── holidays.js           # Public holidays
│   ├── desks.js              # Desk CRUD
│   ├── floorElements.js      # Floor plan elements
│   └── deskBookings.js       # Desk reservation CRUD
│
├── socket/
│   └── presence.js           # Socket.IO presence handlers
│
├── utils/
│   ├── helpers.js            # Case conversion utilities
│   └── logger.js             # Environment-aware logging
│
├── public/
│   ├── index.html            # Main SPA entry
│   ├── checkin.html          # QR code check-in page
│   ├── styles.css            # Application styles
│   ├── auth.js               # Azure AD MSAL integration
│   ├── floor-plan.js         # Floor plan editor
│   └── js/
│       ├── main.js           # App initialization
│       ├── state.js          # Centralized state
│       ├── config.js         # Frontend configuration
│       ├── api.js            # API client
│       ├── fetch-utils.js    # Fetch with retry/timeout
│       ├── calendar.js       # Calendar rendering
│       ├── bookings.js       # Booking operations
│       ├── teams.js          # Team management UI
│       ├── locations.js      # Location management UI
│       ├── holidays.js       # Holiday management
│       ├── desks.js          # Desk operations
│       ├── dragdrop.js       # Drag and drop
│       ├── socket.js         # Socket.IO client
│       ├── theme.js          # Theme switching
│       ├── views.js          # View management
│       ├── utils.js          # UI utilities
│       ├── errors.js         # Error handling
│       ├── validation.js     # Input validation
│       ├── loading.js        # Loading states
│       ├── date-utils.js     # Date handling
│       ├── event-manager.js  # Event listener cleanup
│       └── azure-managers.js # Azure AD integration
│
└── __tests__/
    ├── setup.js              # Jest setup
    ├── mocks/
    │   └── supabase.mock.js  # Supabase mock
    ├── routes/               # Route tests
    ├── middleware/           # Middleware tests
    └── utils/                # Utility tests
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express 4.x |
| **Database** | Supabase (PostgreSQL) |
| **Real-time** | Socket.IO 4.x |
| **Authentication** | Azure AD (MSAL.js 2.x) |
| **Security** | Helmet, express-rate-limit |
| **Testing** | Jest, Supertest |
| **Frontend** | Vanilla ES6 Modules |
| **Maps** | Leaflet + CartoDB tiles |
| **Weather** | Open-Meteo API |

### Database Schema

| Table | Description |
|-------|-------------|
| `locations` | Office locations with capacity and coordinates |
| `teams` | Teams with managers, colors, member counts |
| `bookings` | Team calendar bookings |
| `holidays` | Public holidays |
| `desks` | Floor plan desks with QR codes |
| `floor_elements` | Rooms, walls, labels |
| `desk_bookings` | Individual desk reservations |

See [`supabase-schema.sql`](supabase-schema.sql) for complete schema.

---

## 📡 API Reference

### Authentication

All write operations (POST, PUT, DELETE) require a valid Azure AD token in the `Authorization` header:

```
Authorization: Bearer <id_token>
```

GET requests work without authentication for public read access.

### Endpoints

#### Data

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/api/data` | ❌ | Get all data (locations, teams, bookings, holidays) |

#### Bookings

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/api/bookings` | ❌ | List bookings (filter: year, month, locationId) |
| POST | `/api/bookings` | ✅ | Create booking |
| PUT | `/api/bookings/:id` | ✅ | Update booking |
| DELETE | `/api/bookings/:id` | ✅ | Delete booking |
| GET | `/api/bookings/:id/ics` | ❌ | Download ICS file |

#### Locations

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| POST | `/api/locations` | ✅ | Create location |
| PUT | `/api/locations/:id` | ✅ | Update location |
| DELETE | `/api/locations/:id` | ✅ | Delete location |

#### Teams

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| POST | `/api/teams` | ✅ | Create team |
| PUT | `/api/teams/:id` | ✅ | Update team |
| DELETE | `/api/teams/:id` | ✅ | Delete team |

#### Holidays

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/api/holidays/fetch/:year` | ❌ | Fetch holidays from Nager.Date |
| POST | `/api/holidays` | ✅ | Save holidays |
| DELETE | `/api/holidays/:date` | ✅ | Delete holiday |

#### Desks

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/api/desks` | ❌ | List desks (filter: locationId) |
| POST | `/api/desks` | ✅ | Create desk |
| PUT | `/api/desks/:id` | ✅ | Update desk |
| DELETE | `/api/desks/:id` | ✅ | Delete desk |

#### Floor Elements

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/api/floor-elements` | ❌ | List elements (filter: locationId) |
| POST | `/api/floor-elements` | ✅ | Create element |
| PUT | `/api/floor-elements/:id` | ✅ | Update element |
| DELETE | `/api/floor-elements/:id` | ✅ | Delete element |

#### Desk Bookings

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/api/desk-bookings` | ❌ | List desk bookings |
| POST | `/api/desk-bookings` | ✅ | Create desk booking |
| DELETE | `/api/desk-bookings/:id` | ✅ | Cancel booking |
| POST | `/api/desk-bookings/:id/checkin` | ✅ | Check in |
| GET | `/api/checkin/:qrCode` | ❌ | Get check-in data |

---

## 🔒 Security

### Implemented Protections

| Protection | Implementation |
|------------|----------------|
| **XSS Prevention** | `escapeHtml()` on all user content (72 calls) |
| **Content Security Policy** | Strict CSP via Helmet |
| **Rate Limiting** | 200 req/15min per IP |
| **JWT Validation** | JWKS verification of Azure AD tokens |
| **HTTPS Headers** | HSTS, X-Frame-Options, X-Content-Type-Options |
| **Input Validation** | Frontend and backend validation |
| **SQL Injection** | Parameterized queries via Supabase |

### Security Headers

The server sets these headers via Helmet:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://alcdn.msauth.net ...
Strict-Transport-Security: max-age=15552000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 0
```

---

## 🚢 Deployment

### Render (Recommended)

1. Connect your GitHub repository to [Render](https://render.com)
2. Create a new **Web Service**
3. Render auto-detects `render.yaml` configuration
4. Add environment variables in the Render dashboard
5. Add your Render URL to Azure AD redirect URIs
6. Deploy!

### Environment Variables on Render

Set these in the Render dashboard under **Environment**:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_TENANT_ID`
- `NODE_ENV=production`

### Other Platforms

| Platform | Notes |
|----------|-------|
| [Railway](https://railway.app) | Simple deployment, free tier available |
| [Heroku](https://heroku.com) | Classic PaaS, requires credit card |
| [DigitalOcean](https://www.digitalocean.com/products/app-platform) | App Platform for scalability |
| [Fly.io](https://fly.io) | Edge deployment with free tier |

---

## 🔧 Troubleshooting

### Azure AD Issues

**"AADSTS50011: The reply URL does not match"**
- Add your exact URL (including protocol) to Azure AD → Authentication → Redirect URIs

**"user_cancelled: User cancelled the flow"**
- Check that CSP allows `frame-src` for `login.microsoftonline.com`
- Ensure MSAL is initialized with `await msalInstance.initialize()`

**"Insufficient privileges"**
- Go to Azure AD → API permissions → Grant admin consent
- Ensure `User.Read.All` and `Directory.Read.All` are granted

**No managers in dropdown**
- Go to Settings → Team Roles and select allowed job titles
- Verify users have job titles set in Azure AD

### Database Issues

**"relation does not exist"**
- Run `supabase-schema.sql` in the Supabase SQL Editor

**"permission denied"**
- Ensure you're using the **service role key**, not the anon key

### Deployment Issues

**"X-Forwarded-For header is set but trust proxy is false"**
- Already fixed: `app.set('trust proxy', 1)` is configured

**Rate limit errors in development**
- The limit is 200 requests per 15 minutes
- Restart server or wait for the window to reset

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) — PostgreSQL backend
- [Azure AD](https://azure.microsoft.com) — Enterprise authentication
- [Socket.IO](https://socket.io) — Real-time communication
- [Leaflet](https://leafletjs.com) — Interactive maps
- [Open-Meteo](https://open-meteo.com) — Weather API
- [Nager.Date](https://date.nager.at) — Public holidays API
