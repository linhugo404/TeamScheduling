# 🪟 Windows VM Deployment Guide

Complete guide for hosting the Office Booking System on a Windows Server VM.

---

## 📋 Prerequisites

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| **Node.js** | 18+ (LTS recommended) | [nodejs.org](https://nodejs.org/) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/download/win) |
| **PM2** (Optional) | Latest | `npm install -g pm2` |

### System Requirements

- **OS:** Windows Server 2016+ or Windows 10/11 Pro
- **RAM:** Minimum 2GB (4GB+ recommended)
- **Disk Space:** 500MB+ for application
- **Network:** Port 3000 (or your chosen port) accessible

---

## 🚀 Step-by-Step Deployment

### Step 1: Install Node.js

1. Download Node.js LTS from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. **Important:** Check "Add to PATH" during installation
4. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

### Step 2: Clone/Download the Application

**Option A: Using Git (Recommended)**
```powershell
# Navigate to your deployment directory
cd C:\inetpub\wwwroot  # or your preferred location

# Clone the repository
git clone https://github.com/your-org/office-booking.git
cd office-booking
```

**Option B: Manual Copy**
1. Copy the entire project folder to your VM (e.g., `C:\apps\office-booking`)
2. Open PowerShell in that directory

### Step 3: Install Dependencies

```powershell
# Navigate to project directory
cd C:\apps\office-booking  # or your path

# Install all dependencies
npm install --production
```

> **Note:** Use `--production` flag to skip dev dependencies (saves space and time)

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```powershell
# Create .env file
New-Item -Path .env -ItemType File
```

Edit `.env` with your credentials:

```env
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key

# Azure AD (Required for authentication)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_TENANT_ID=your-tenant-id

# Server Configuration
PORT=3000
NODE_ENV=production
```

> ⚠️ **Security:** Never commit `.env` to version control. It's already in `.gitignore`.

### Step 5: Initialize Database

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the SQL script

### Step 6: Configure Azure AD Redirect URIs

1. Go to [Azure Portal](https://portal.azure.com) → **Azure AD** → **App registrations**
2. Select your application
3. Go to **Authentication** → **Redirect URIs**
4. Add your Windows VM URL:
   - `http://your-vm-ip:3000` (if using IP)
   - `https://your-domain.com` (if using domain with HTTPS)

---

## 🏃 Running the Application

> **Note:** The `npm start` script uses Unix-style environment variable syntax. On Windows, you have two options:
> 1. Set `NODE_ENV=production` in your `.env` file (recommended)
> 2. Use PowerShell syntax: `$env:NODE_ENV="production"; npm start`
> 3. Or run directly: `node server.js` (reads from .env file)

### Option 1: Direct Node.js (Simple, but stops on logout)

```powershell
# Start the application
npm start

# Or using node directly
$env:NODE_ENV="production"; node server.js
```

**Pros:** Simple, no additional setup  
**Cons:** Stops when you close PowerShell or log out

### Option 2: PM2 (Recommended for Production)

PM2 keeps your app running in the background and restarts it automatically.

#### Install PM2 Globally

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

#### Start Application with PM2

```powershell
# Start the application
pm2 start server.js --name "office-booking" --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on Windows boot
pm2-startup install
```

#### PM2 Useful Commands

```powershell
# View running processes
pm2 list

# View logs
pm2 logs office-booking

# Restart application
pm2 restart office-booking

# Stop application
pm2 stop office-booking

# Monitor (CPU, memory)
pm2 monit
```

### Option 3: Windows Service (Most Robust)

Use `node-windows` to run as a Windows Service:

```powershell
# Install node-windows globally
npm install -g node-windows

# Install service
node-windows install --name "OfficeBooking" --script "C:\apps\office-booking\server.js" --env NODE_ENV=production
```

---

## 🔥 Firewall Configuration

### Allow Port Through Windows Firewall

```powershell
# Open PowerShell as Administrator

# Allow inbound traffic on port 3000
New-NetFirewallRule -DisplayName "Office Booking System" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Or using GUI:
# Control Panel → Windows Defender Firewall → Advanced Settings
# Inbound Rules → New Rule → Port → TCP → 3000 → Allow
```

### Verify Port is Open

```powershell
# Check if port is listening
netstat -an | findstr :3000

# Test from another machine
Test-NetConnection -ComputerName your-vm-ip -Port 3000
```

---

## 🌐 Network Access

### Internal Network Access

If your VM is on an internal network:
- Access via: `http://vm-internal-ip:3000`
- Example: `http://192.168.1.100:3000`

### External Access

1. **Get VM's Public IP:**
   ```powershell
   # In PowerShell
   (Invoke-WebRequest -Uri "https://api.ipify.org").Content
   ```

2. **Configure Router/Firewall:**
   - Port forward external port (e.g., 80 or 443) to VM's port 3000
   - Or use a reverse proxy (see below)

3. **Update Azure AD Redirect URI:**
   - Add `http://your-public-ip:3000` to Azure AD redirect URIs

### Using a Domain Name (Optional)

1. Point your domain's A record to your VM's public IP
2. Update Azure AD redirect URI to `https://yourdomain.com`
3. Set up HTTPS (see SSL/TLS section below)

---

## 🔒 SSL/TLS Setup (HTTPS)

### Option 1: Reverse Proxy with IIS (Recommended)

1. **Install IIS:**
   ```powershell
   # Run as Administrator
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-ApplicationInit
   ```

2. **Install URL Rewrite and ARR:**
   - Download [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite)
   - Download [Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)

3. **Configure IIS Reverse Proxy:**
   - Create a new site in IIS Manager
   - Set up URL Rewrite rule to proxy to `http://localhost:3000`
   - Configure SSL certificate

### Option 2: Nginx (Alternative)

1. **Install Nginx for Windows:**
   - Download from [nginx.org](http://nginx.org/en/download.html)
   - Extract to `C:\nginx`

2. **Configure nginx.conf:**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Set up SSL with Let's Encrypt:**
   - Use [win-acme](https://www.win-acme.com/) for automatic certificate management

---

## 🔄 Auto-Start on Boot

### Using PM2 (Easiest)

```powershell
# Already done if you ran pm2-startup install
pm2-startup install
pm2 save
```

### Using Task Scheduler

1. Open **Task Scheduler** (`taskschd.msc`)
2. Create Basic Task
3. **Trigger:** When computer starts
4. **Action:** Start a program
5. **Program:** `C:\Program Files\nodejs\node.exe`
6. **Arguments:** `C:\apps\office-booking\server.js`
7. **Start in:** `C:\apps\office-booking`
8. **Add arguments:** `NODE_ENV=production` (or use .env file)

### Using Windows Service

If you used `node-windows`, the service will start automatically on boot.

---

## 📊 Monitoring & Logging

### Application Logs

**With PM2:**
```powershell
# View logs
pm2 logs office-booking

# Log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**Without PM2:**
- Logs go to console/stdout
- Consider redirecting to a file:
  ```powershell
  node server.js > app.log 2>&1
  ```

### Windows Event Viewer

If running as a service, check:
- **Event Viewer** → **Windows Logs** → **Application**

### Health Check

Create a simple health check endpoint test:

```powershell
# Test if application is running
Invoke-WebRequest -Uri http://localhost:3000/api/data -UseBasicParsing
```

---

## 🔧 Troubleshooting

### Application Won't Start

**Check Node.js version:**
```powershell
node --version  # Should be 18+
```

**Check if port is already in use:**
```powershell
netstat -ano | findstr :3000
# If port is in use, kill the process:
Stop-Process -Id <PID> -Force
```

**Check environment variables:**
```powershell
# Verify .env file exists and has correct values
Get-Content .env
```

**Check logs:**
```powershell
# With PM2
pm2 logs office-booking --lines 50

# Direct node
node server.js
```

### Can't Access from Network

1. **Check Windows Firewall:**
   ```powershell
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Office*"}
   ```

2. **Check if app is listening on correct interface:**
   ```powershell
   netstat -an | findstr :3000
   # Should show 0.0.0.0:3000 (all interfaces), not just 127.0.0.1:3000
   ```

3. **Verify server.js binds to all interfaces:**
   - The app should listen on `0.0.0.0` (default Express behavior)
   - Check `server.js` line 190: `httpServer.listen(PORT, ...)`

### Azure AD Login Issues

1. **Verify redirect URI matches exactly:**
   - Check Azure Portal → App registrations → Authentication
   - Must include protocol (`http://` or `https://`)

2. **Check CSP headers:**
   - Ensure `frameSrc` includes `https://login.microsoftonline.com`
   - Already configured in `server.js` line 77

### Database Connection Issues

1. **Verify Supabase credentials:**
   ```powershell
   # Test connection (create test.js)
   node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
   ```

2. **Check network connectivity:**
   ```powershell
   Test-NetConnection your-project.supabase.co -Port 443
   ```

---

## 🔐 Security Best Practices

### 1. Use Environment Variables
- Never hardcode credentials
- Keep `.env` file secure (not in version control)

### 2. Enable HTTPS
- Use reverse proxy (IIS/Nginx) with SSL certificate
- Update Azure AD redirect URIs to use `https://`

### 3. Windows Firewall
- Only open necessary ports (3000 or 80/443)
- Restrict access to specific IPs if possible

### 4. Regular Updates
```powershell
# Update npm packages
npm audit
npm audit fix

# Update Node.js when new LTS is released
```

### 5. Run as Non-Admin User
- Create a dedicated service account
- Run Node.js process with limited privileges

### 6. Enable Windows Updates
- Keep Windows Server updated
- Enable automatic security updates

---

## 📈 Performance Optimization

### 1. Increase Node.js Memory (if needed)

```powershell
# For PM2
pm2 start server.js --name "office-booking" --max-memory-restart 1G

# For direct node
node --max-old-space-size=1024 server.js
```

### 2. Enable Compression
- Already enabled in `server.js` (line 97)
- Gzip compression for all responses

### 3. Static File Caching
- Already configured in `server.js` (line 106-115)
- 1-hour cache for CSS/JS files

### 4. Monitor Resource Usage

```powershell
# With PM2
pm2 monit

# Windows Task Manager
# Check Node.js process CPU and memory usage
```

---

## 🔄 Updating the Application

### Update Process

```powershell
# Stop the application
pm2 stop office-booking  # or stop your service

# Pull latest changes
git pull origin main

# Install new dependencies (if any)
npm install --production

# Restart
pm2 restart office-booking  # or start your service
```

### Rollback Plan

```powershell
# Keep previous version
git checkout <previous-commit-hash>
pm2 restart office-booking
```

---

## 📞 Support & Resources

- **Application Logs:** `pm2 logs office-booking`
- **Windows Event Viewer:** Check Application logs
- **Node.js Documentation:** [nodejs.org/docs](https://nodejs.org/docs/)
- **PM2 Documentation:** [pm2.keymetrics.io](https://pm2.keymetrics.io/)

---

## ✅ Deployment Checklist

- [ ] Node.js 18+ installed and verified
- [ ] Application cloned/copied to VM
- [ ] Dependencies installed (`npm install --production`)
- [ ] `.env` file created with all required variables
- [ ] Database schema initialized in Supabase
- [ ] Azure AD redirect URIs configured
- [ ] Application starts successfully (`npm start`)
- [ ] PM2 or Windows Service configured (optional)
- [ ] Windows Firewall configured (port 3000)
- [ ] Application accessible from network
- [ ] HTTPS configured (if using domain)
- [ ] Auto-start on boot configured
- [ ] Monitoring/logging set up
- [ ] Health check endpoint tested
- [ ] Database backups configured (see below)

---

## 💾 Database Backups (PostgreSQL Only)

If you're using local PostgreSQL (not Supabase), set up automated backups:

### Quick Setup

```powershell
# Run as Administrator
.\setup-backup-schedule.ps1

# Verify backup system
.\check-backup-status.ps1
```

**Features:**
- ✅ Daily automated backups at 2:00 AM
- ✅ Local storage (7 days) + OneDrive cloud (30 days)
- ✅ Automatic cleanup of old backups
- ✅ Easy restore with interactive menu

**Documentation:**
- Quick reference: `BACKUP-README.md`
- Complete guide: `BACKUP-GUIDE.md`
- Restore database: `.\restore-database.ps1`

---

**🎉 Your application should now be running on your Windows VM!**

Access it at: `http://your-vm-ip:3000` or `https://your-domain.com`
