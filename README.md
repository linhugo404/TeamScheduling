# Office Booking System

A modern, beautiful web application for managing office space bookings and desk reservations with interactive floor plans and real-time collaboration.

![Office Booking System](https://img.shields.io/badge/Node.js-v14+-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### 📅 Team Scheduling
- **Calendar View** - Visual monthly calendar with drag & drop booking rescheduling
- **Multiple Locations** - Support for multiple offices with addresses and interactive maps
- **Team Management** - Track teams with manager info, photos, member counts, and custom colors
- **Capacity Tracking** - Real-time capacity indicators with warnings
- **Public Holidays** - Fetch South African holidays automatically from the internet

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
- **Instant Updates** - Bookings sync across all connected users
- **Calendar Sync** - Export to Google Calendar, Outlook, or ICS files

### 🎨 User Experience
- **Modern UI** - Beautiful dark theme with smooth animations
- **Responsive Design** - Works on desktop and mobile
- **Blueprint-Style Floor Plans** - Professional office layout visualization

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

### Booking Office Space (Team Scheduling)

1. Select your **location** from the sidebar dropdown
2. Click on any **weekday** in the calendar
3. Choose a **team** (member count auto-fills)
4. Click **Save Booking**
5. Drag and drop bookings to reschedule them

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
5. Enter your name and team
6. Click **Book Desk**

### QR Code Check-In

Each desk has a unique QR code. When you arrive at the office:
1. Scan the QR code on your desk
2. View your booking on the check-in page
3. Click **Check In Now** during your booked time slot

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

All data is stored in `data/bookings.json`. This file is automatically created on first run with default locations and holidays.

You can edit this file directly or backup/restore it as needed.

## Project Structure

```
TeamScheduling/
├── server.js           # Express backend server with Socket.IO
├── package.json        # Node.js dependencies
├── render.yaml         # Render deployment config
├── public/
│   ├── index.html      # Main HTML page
│   ├── styles.css      # Styling (dark theme)
│   ├── app.js          # Frontend JavaScript
│   └── checkin.html    # QR code check-in page
├── data/
│   └── bookings.json   # Data storage (auto-created)
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
