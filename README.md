# Office Booking System

A modern, beautiful web application for managing office space bookings and desk reservations with interactive floor plans, real-time collaboration, and Azure AD integration.

![Office Booking System](https://img.shields.io/badge/Node.js-v14+-green) ![License](https://img.shields.io/badge/license-MIT-blue) ![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E) ![Auth](https://img.shields.io/badge/Auth-Azure%20AD-0078D4)

## Features

### 🔐 Azure AD Authentication
- **Single Sign-On** - Sign in with your Microsoft work account
- **Team Roles Configuration** - Define which job titles can lead teams
- **Auto-populate from Azure AD** - Manager photos and direct reports count
- **Org Structure Integration** - Pull team member counts from Azure AD hierarchy

### 📅 Team Scheduling
- **Calendar View** - Visual monthly calendar with drag & drop booking rescheduling
- **Multiple Locations** - Support for multiple offices with addresses and interactive maps
- **Team Management** - Track teams with manager info, photos, member counts, and custom colors
- **Capacity Tracking** - Real-time capacity indicators with warnings
- **Public Holidays** - Fetch South African holidays automatically from the internet
- **Weather Forecast** - Weather icons on calendar days using Open-Meteo API
- **Keyboard Shortcuts** - Arrow keys to navigate months

### 🪑 Desk Booking & Floor Plans
- **Interactive Floor Plan Editor** - Visual drag-and-drop layout designer
- **Room Elements** - Create labeled room boundaries with custom colors
- **Walls & Labels** - Add walls and text labels to define spaces
- **Desk Types**:
  - **Hotseat** - Available for anyone to book
  - **Team Seat** - Reserved for specific teams
  - **Unavailable** - Blocked desks (maintenance, reserved)
- **Chair Positions** - Configure chair placement (top, bottom, left, right)
- **Floor Selector** - Switch between multiple floors per location
- **Time Slider** - Preview desk occupancy at any time of day
- **QR Code Check-In** - Scan QR codes at desks to check in

### 🗺️ Maps & Location
- **Location Maps** - Dark-themed interactive maps using Leaflet with CartoDB tiles
- **Address Geocoding** - Automatic map positioning from addresses

### 🔄 Real-Time Collaboration
- **Live Presence** - See who else is viewing the same calendar
- **Instant Updates** - Bookings sync across all connected users via Socket.IO
- **Calendar Sync** - Export to Google Calendar, Outlook, or ICS files

### 🎨 User Experience
- **Modern UI** - Beautiful Digiata-inspired dark theme with orange accents
- **Dark/Light Mode** - Auto-detects system preference, with manual override option
- **Responsive Design** - Desktop calendar grid (>768px), mobile list view (≤768px), hamburger menu (≤1024px)
- **Smooth Animations** - Fluid month navigation transitions with optimistic UI updates
- **Blueprint-Style Floor Plans** - Professional office layout visualization
- **Drag & Drop** - Reschedule bookings with instant visual feedback

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v14 or higher
- [Supabase](https://supabase.com/) account (free tier works)
- [Azure AD](https://portal.azure.com/) tenant (for authentication)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/linhugo404/TeamScheduling.git
cd TeamScheduling
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase:
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the SQL from `supabase-schema.sql` in the Supabase SQL Editor
   - Copy your project URL and API keys

4. Create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
```

5. Set up Azure AD (see [Azure AD Setup](#azure-ad-setup) below)

6. Start the server:

```bash
npm start
```

7. Open your browser and go to:

```
http://localhost:3000
```

## Azure AD Setup

### Step 1: Register the Application

1. Go to [portal.azure.com](https://portal.azure.com)
2. Navigate to **Azure Active Directory → App registrations**
3. Click **"+ New registration"**
4. Configure:
   - **Name**: `Office Booking System`
   - **Supported account types**: "Accounts in this organizational directory only"
   - **Redirect URI**: 
     - Platform: **Single-page application (SPA)**
     - URI: `http://localhost:3000/auth/callback`
5. Click **Register**

### Step 2: Add Redirect URIs

After registration, go to **Authentication** and add all your redirect URIs:

| Environment | Redirect URI |
|-------------|--------------|
| Local Dev | `http://localhost:3000/auth/callback` |
| Render | `https://your-app.onrender.com/auth/callback` |
| Custom Domain | `https://booking.yourcompany.com/auth/callback` |

### Step 3: Configure API Permissions

Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**:

| Permission | Type | Purpose |
|------------|------|---------|
| `User.Read` | Delegated | Read signed-in user's profile |
| `User.Read.All` | Delegated | Read all users' profiles (for manager dropdown) |
| `Directory.Read.All` | Delegated | Read org structure (for direct reports count) |

Click **"Grant admin consent for [your tenant]"** after adding permissions.

### Step 4: Configure Environment Variables

Copy your **Application (client) ID** and **Directory (tenant) ID** from the Overview page.

Add them to your `.env` file:

```env
AZURE_AD_CLIENT_ID=your-client-id-here
AZURE_AD_TENANT_ID=your-tenant-id-here
```

The app will automatically load these from the server.

### Azure AD Permissions Summary

| Permission | Required | Purpose |
|------------|----------|---------|
| `User.Read` | ✅ Yes | Basic sign-in and profile |
| `User.Read.All` | ✅ Yes | Fetch managers by job title |
| `Directory.Read.All` | ✅ Yes | Get direct reports count |
| `User.ReadBasic.All` | Optional | Read basic profiles of all users |

## Team Roles Configuration

The app integrates with Azure AD to automatically populate team information:

### Setting Up Team Lead Roles

1. Sign in to the app with your Microsoft account
2. Go to **Settings → Team Roles**
3. The app fetches all job titles from your Azure AD
4. Click on job titles to mark them as "allowed to lead teams"
   - e.g., "Senior Manager", "Team Lead", "Engineering Manager"

### Creating Teams from Azure AD

1. Go to **Settings → Teams**
2. Click **Add Team**
3. Click **"Select from Azure AD"**
4. Choose a manager from the dropdown (only shows people with allowed job titles)
5. The app automatically fills:
   - Manager name
   - Manager photo (from Azure AD)
   - Team member count (from direct reports)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` or `A` | Previous month |
| `→` or `D` | Next month |

## Usage

### Booking Office Space (Team Scheduling)

1. Sign in with your Microsoft work account
2. Select your **location** from the sidebar dropdown
3. Click on any **weekday** in the calendar
4. Choose a **team** (member count auto-fills)
5. Click **Save Booking**
6. Drag and drop bookings to reschedule them

### Using the Floor Plan Editor

1. Click **Floor Plan** in the sidebar
2. Select your **location** and **floor**
3. Click **Edit Layout** to enter edit mode
4. Use the toolbar to add elements:
   - **Desk** - Add bookable desk with chairs
   - **Room** - Create labeled room boundaries
   - **Wall** - Add wall segments
   - **Label** - Add text labels
5. **Drag** elements to reposition them
6. **Resize** rooms and walls using edge/corner handles
7. Click **Done Editing** to save

### Booking a Desk

1. Go to **Floor Plan** view
2. Use the **time slider** to see availability
3. Click on an available desk (blue)
4. Select your time range
5. If signed in via Azure AD, your name is auto-filled; otherwise enter manually
6. Click **Book Desk**

### QR Code Check-In

Each desk has a unique QR code. When you arrive at the office:
1. Scan the QR code on your desk
2. View your booking on the check-in page
3. Click **Check In Now** during your booked time slot

### Managing Teams

1. Click **Settings → Teams** in the sidebar
2. Click **Add Team** to create a new team
3. Use **"Select from Azure AD"** to pick a manager, or enter manually
4. Team member counts can auto-populate from Azure AD direct reports
5. Team member counts automatically sync to all bookings

### Managing Locations

1. Click **Settings → Locations** in the sidebar
2. Click **Add Location** to add a new office
3. Set the name, address, and daily capacity
4. Locations display an interactive map when an address is provided

### Public Holidays

1. Click **Settings → Holidays** in the sidebar
2. Select a year and click **Fetch SA Holidays**
3. Holidays are automatically blocked from bookings

## Data Storage

All data is stored in **Supabase** (PostgreSQL). The schema includes:

- `locations` - Office locations with capacity and addresses
- `teams` - Teams with managers, colors, and member counts
- `bookings` - Team calendar bookings
- `holidays` - Public holidays
- `desks` - Floor plan desks
- `floor_elements` - Rooms, walls, and labels
- `desk_bookings` - Individual desk reservations

See `supabase-schema.sql` for the complete database schema.

## Project Structure

```
TeamScheduling/
├── server.js              # Express backend with Socket.IO
├── package.json           # Node.js dependencies
├── render.yaml            # Render deployment config
├── supabase-schema.sql    # Database schema
├── .env                   # Environment variables (not in git)
├── public/
│   ├── index.html         # Main HTML page
│   ├── styles.css         # Styling (dark/light themes)
│   ├── auth.js            # Azure AD authentication (MSAL.js)
│   ├── floor-plan.js      # Floor plan editor and desk booking
│   ├── checkin.html       # QR code check-in page
│   └── js/                # Modular ES6 JavaScript
│       ├── main.js        # App entry point and initialization
│       ├── state.js       # Centralized state management
│       ├── api.js         # API calls to backend
│       ├── calendar.js    # Calendar rendering (grid & list views)
│       ├── bookings.js    # Booking modal and CRUD operations
│       ├── teams.js       # Team management
│       ├── locations.js   # Location management
│       ├── holidays.js    # Public holidays
│       ├── dragdrop.js    # Drag and drop functionality
│       ├── theme.js       # Theme management (auto-detect system)
│       ├── socket.js      # Real-time Socket.IO handling
│       ├── views.js       # View switching logic
│       ├── utils.js       # Utility functions
│       └── azure-managers.js  # Azure AD manager selection
└── README.md
```

## API Endpoints

### Team Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data` | Get all data (locations, teams, bookings, holidays) |
| GET | `/api/bookings` | Get bookings (filter by year, month, location) |
| POST | `/api/bookings` | Create a new booking |
| PUT | `/api/bookings/:id` | Update a booking |
| DELETE | `/api/bookings/:id` | Delete a booking |
| GET | `/api/bookings/:id/ics` | Download ICS calendar file |

### Locations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/locations` | Add a new location |
| PUT | `/api/locations/:id` | Update a location |
| DELETE | `/api/locations/:id` | Delete a location |

### Teams

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/teams` | Add a new team |
| PUT | `/api/teams/:id` | Update a team |
| DELETE | `/api/teams/:id` | Delete a team |

### Desks & Floor Plan

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/desks` | Get desks (filter by locationId) |
| POST | `/api/desks` | Create a new desk |
| PUT | `/api/desks/:id` | Update a desk |
| DELETE | `/api/desks/:id` | Delete a desk |
| GET | `/api/floor-elements` | Get floor elements (rooms, walls, labels) |
| POST | `/api/floor-elements` | Create a floor element |
| PUT | `/api/floor-elements/:id` | Update a floor element |
| DELETE | `/api/floor-elements/:id` | Delete a floor element |

### Desk Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/desk-bookings` | Get desk bookings (filter by date, location, desk) |
| POST | `/api/desk-bookings` | Create a desk booking |
| DELETE | `/api/desk-bookings/:id` | Cancel a desk booking |
| POST | `/api/desk-bookings/:id/checkin` | Check in to a booking |
| GET | `/api/checkin/:qrCode` | Get check-in page data |

### Holidays

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/holidays/fetch/:year` | Fetch public holidays from Nager.Date API |
| POST | `/api/holidays` | Save holidays to database |
| DELETE | `/api/holidays/:date` | Delete a holiday |

### Weather

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/weather/geocode` | Convert address to coordinates |
| GET | `/api/weather/forecast` | Get weather forecast for coordinates |

## Real-Time Features

The application uses **Socket.IO** for real-time collaboration:

- **Presence tracking**: See who else is viewing the same month/location
- **Live booking updates**: When someone creates, updates, or deletes a booking, all viewers see the change instantly

## Technologies Used

- **Backend**: Node.js, Express, Socket.IO, Compression
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Azure AD (MSAL.js), Microsoft Graph API
- **Frontend**: Vanilla JavaScript, Leaflet.js (maps)
- **Maps**: CartoDB dark tiles, OpenStreetMap Nominatim (geocoding)
- **Weather**: Open-Meteo API
- **Styling**: Custom CSS with CSS variables for theming

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ Yes | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | ✅ Yes | Supabase service role key |
| `AZURE_AD_CLIENT_ID` | ✅ Yes | Azure AD Application (client) ID |
| `AZURE_AD_TENANT_ID` | ✅ Yes | Azure AD Directory (tenant) ID |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Set to `production` for caching |

Example `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
AZURE_AD_CLIENT_ID=e31dc847-f351-4005-bacd-166f5e27752d
AZURE_AD_TENANT_ID=68fd3ba4-4cf9-4c2d-be97-cdb6a23e18b6
```

## Deployment

### Render (Recommended)

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Add environment variables in the Render dashboard
4. Deploy! (uses `render.yaml` configuration)
5. Add your Render URL to Azure AD redirect URIs

### Other Options

- **[Railway](https://railway.app)** - Simple deployment with free tier
- **[Heroku](https://heroku.com)** - Classic PaaS option
- **[DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform)** - Scalable hosting

## Troubleshooting

### Azure AD Issues

**"AADSTS50011: The reply URL does not match"**
- Add the exact URL you're accessing from to the Azure AD redirect URIs

**"Insufficient privileges" when fetching users**
- Ensure `User.Read.All` and `Directory.Read.All` permissions are granted
- Click "Grant admin consent" in Azure AD

**No managers appearing in dropdown**
- Go to Settings → Team Roles and select allowed job titles first
- Ensure people have job titles set in Azure AD

## License

MIT License - feel free to use and modify as needed.
