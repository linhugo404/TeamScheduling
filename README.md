# Office Booking System

A modern, beautiful web application for managing office space bookings across multiple locations with real-time collaboration features.

![Office Booking System](https://img.shields.io/badge/Node.js-v14+-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **📅 Calendar View** - Visual monthly calendar with drag & drop booking rescheduling
- **🏢 Multiple Locations** - Support for multiple offices with addresses and interactive maps
- **👥 Team Management** - Track teams with manager info, photos, member counts, and custom colors
- **📊 Capacity Tracking** - Real-time capacity indicators with warnings
- **🗺️ Location Maps** - Dark-themed interactive maps using Leaflet with CartoDB tiles
- **👁️ Real-Time Presence** - See who else is viewing the same calendar (Socket.IO)
- **🔄 Live Updates** - Bookings sync across all connected users in real-time
- **📆 Calendar Sync** - Export bookings to Google Calendar, Outlook, or download ICS files
- **🎨 Modern UI** - Beautiful dark/light theme with smooth animations
- **🎉 Public Holidays** - Fetch South African holidays automatically from the internet
- **💾 JSON Storage** - Simple file-based data persistence

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v14 or higher

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

3. Start the server:

```bash
npm start
```

4. Open your browser and go to:

```
http://localhost:3000
```

## Usage

### Booking Office Space

1. Select your **location** from the sidebar dropdown
2. Click on any **weekday** in the calendar
3. Choose a **team** (member count auto-fills)
4. Click **Save Booking**
5. Drag and drop bookings to reschedule them

### Managing Teams

1. Click **Teams** in the sidebar
2. Click **Add Team** to create a new team
3. Enter team details:
   - Team name and color
   - Manager/SM name and photo URL
   - Number of team members
   - Associated office location
4. Team member counts automatically sync to all bookings

### Managing Locations

1. Click **Locations** in the sidebar
2. Click **Add Location** to add a new office
3. Set the name, address, and daily capacity
4. Locations display an interactive map when an address is provided

### Public Holidays

1. Click **Holidays** in the sidebar
2. Select a year and click **Fetch SA Holidays**
3. Holidays are automatically blocked from bookings

## Data Storage

All data is stored in `data/bookings.json`. This file is automatically created on first run with:

- **3 default locations**: JHB Office, Cape Town, Durban
- **South African public holidays** for 2026

You can edit this file directly or backup/restore it as needed.

## Project Structure

```
TeamScheduling/
├── server.js           # Express backend server with Socket.IO
├── package.json        # Node.js dependencies
├── render.yaml         # Render deployment config
├── public/
│   ├── index.html      # Main HTML page
│   ├── styles.css      # Styling (dark/light themes)
│   └── app.js          # Frontend JavaScript
├── data/
│   └── bookings.json   # Data storage (auto-created)
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data` | Get all data (locations, teams, bookings, holidays) |
| GET | `/api/bookings` | Get bookings (filter by year, month, location) |
| POST | `/api/bookings` | Create a new booking |
| PUT | `/api/bookings/:id` | Update a booking |
| DELETE | `/api/bookings/:id` | Delete a booking |
| GET | `/api/bookings/:id/ics` | Download ICS calendar file for a booking |
| POST | `/api/locations` | Add a new location |
| PUT | `/api/locations/:id` | Update a location |
| DELETE | `/api/locations/:id` | Delete a location |
| POST | `/api/teams` | Add a new team |
| PUT | `/api/teams/:id` | Update a team |
| DELETE | `/api/teams/:id` | Delete a team |
| GET | `/api/holidays/fetch/:year` | Fetch public holidays from Nager.Date API |
| POST | `/api/holidays` | Save holidays to database |
| DELETE | `/api/holidays/:date` | Delete a holiday |

## Real-Time Features

The application uses Socket.IO for real-time collaboration:

- **Presence tracking**: See who else is viewing the same month/location
- **Live booking updates**: When someone creates, updates, or deletes a booking, all viewers see the change instantly

## Technologies Used

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, Leaflet.js (maps)
- **Maps**: CartoDB dark tiles, OpenStreetMap Nominatim (geocoding)
- **Styling**: Custom CSS with CSS variables for theming

## Hosting Options

To host this application online, you can use:

- **[Render](https://render.com)** - Free tier available, easy Node.js deployment (render.yaml included)
- **[Railway](https://railway.app)** - Simple deployment with free tier
- **[Heroku](https://heroku.com)** - Classic PaaS option
- **[DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform)** - Scalable hosting

For production, consider switching from JSON file storage to a database like MongoDB or PostgreSQL for better reliability and concurrent access.

## License

MIT License - feel free to use and modify as needed.
