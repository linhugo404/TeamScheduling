# Office Booking System

A modern, beautiful web application for managing office space bookings across multiple locations.

![Office Booking System](https://img.shields.io/badge/Node.js-v14+-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **📅 Calendar View** - Visual monthly calendar showing all bookings
- **🏢 Multiple Locations** - Support for JHB, Cape Town, Durban, or any custom locations
- **👥 Team Management** - Track which teams are booking and how many people
- **📊 Capacity Tracking** - Real-time capacity indicators with warnings
- **🎨 Modern UI** - Beautiful dark theme with smooth animations
- **💾 JSON Storage** - Simple file-based data persistence
- **🎉 Public Holidays** - South African public holidays pre-configured for 2026

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v14 or higher

### Installation

1. Open a terminal in the project folder:

```bash
cd E:\OfficeSchedule
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
3. Choose a **team** and enter the **number of people**
4. Click **Save Booking**

### Managing Teams

1. Click **Teams** in the sidebar
2. Click **Add Team** to create a new team
3. Enter a name and choose a color
4. Teams can be deleted from this view

### Managing Locations

1. Click **Locations** in the sidebar
2. Click **Add Location** to add a new office
3. Set the name and daily capacity
4. Locations can be deleted (this also removes all bookings for that location)

## Data Storage

All data is stored in `data/bookings.json`. This file is automatically created on first run with:

- **3 default locations**: JHB Office (21 capacity), Cape Town (15), Durban (10)
- **7 default teams**: DISCOVERY, VITALITY, VITALITY-TM1, VITALITY-TM2, ABSA CIB, NEDBANK/KN, Genasys
- **South African public holidays** for 2026

You can edit this file directly or backup/restore it as needed.

## Project Structure

```
OfficeSchedule/
├── server.js           # Express backend server
├── package.json        # Node.js dependencies
├── public/
│   ├── index.html      # Main HTML page
│   ├── styles.css      # Styling
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
| POST | `/api/locations` | Add a new location |
| DELETE | `/api/locations/:id` | Delete a location |
| POST | `/api/teams` | Add a new team |
| DELETE | `/api/teams/:id` | Delete a team |

## Hosting Options

To host this application online, you can use:

- **[Render](https://render.com)** - Free tier available, easy Node.js deployment
- **[Railway](https://railway.app)** - Simple deployment with free tier
- **[Heroku](https://heroku.com)** - Classic PaaS option
- **[DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform)** - Scalable hosting

For hosting, you may want to switch from JSON file storage to a database like MongoDB or PostgreSQL for better reliability.

## License

MIT License - feel free to use and modify as needed.

