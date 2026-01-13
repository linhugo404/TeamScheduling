# 🐘 PostgreSQL Setup Guide for Windows VM

Complete guide for running PostgreSQL directly on your Windows VM instead of using Supabase.

---

## 📋 Prerequisites

- Windows Server 2016+ or Windows 10/11 Pro
- Administrator access
- At least 2GB RAM available
- 1GB+ disk space for PostgreSQL

---

## 🚀 Step 1: Install PostgreSQL

### Option A: PostgreSQL Installer (Recommended)

1. **Download PostgreSQL:**
   - Go to [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
   - Download the latest version (16+ recommended)
   - Or use the [EnterpriseDB installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)

2. **Run the Installer:**
   - Run the downloaded `.exe` file
   - **Important settings:**
     - **Installation Directory:** `C:\Program Files\PostgreSQL\16` (default)
     - **Data Directory:** `C:\Program Files\PostgreSQL\16\data` (default)
     - **Port:** `5432` (default, or choose another if needed)
     - **Superuser Password:** Choose a strong password (save this!)
     - **Locale:** Default (or choose your preference)

3. **Complete Installation:**
   - The installer will install PostgreSQL and optionally pgAdmin (GUI tool)
   - **Important:** Check "Stack Builder" if you want additional tools (optional)

4. **Verify Installation:**
   ```powershell
   # Check PostgreSQL version
   psql --version
   
   # Or check service
   Get-Service postgresql*
   ```

### Option B: Chocolatey (If you have Chocolatey installed)

```powershell
# Install PostgreSQL
choco install postgresql --params '/Password:YourPassword123'

# Start PostgreSQL service
Start-Service postgresql-x64-16
```

---

## 🔧 Step 2: Configure PostgreSQL

### Create Database and User

1. **Open PostgreSQL Command Line (psql):**
   - Open **Command Prompt** or **PowerShell**
   - Navigate to PostgreSQL bin directory:
     ```powershell
     cd "C:\Program Files\PostgreSQL\16\bin"
     ```

2. **Connect as Superuser:**
   ```powershell
   psql -U postgres
   ```
   - Enter the password you set during installation

3. **Create Database:**
   ```sql
   -- Create database
   CREATE DATABASE office_booking;
   
   -- Create application user
   CREATE USER office_app WITH PASSWORD 'your_secure_password_here';
   
   -- Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE office_booking TO office_app;
   
   -- Connect to the new database
   \c office_booking
   
   -- Grant schema privileges
   GRANT ALL ON SCHEMA public TO office_app;
   
   -- Exit psql
   \q
   ```

### Configure PostgreSQL for Network Access (Optional)

If you need to access PostgreSQL from other machines:

1. **Edit `pg_hba.conf`:**
   - Location: `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`
   - Add line for your network (replace with your IP range):
     ```
     # Allow connections from local network
     host    all             all             192.168.1.0/24          md5
     ```

2. **Edit `postgresql.conf`:**
   - Location: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`
   - Find and uncomment:
     ```conf
     listen_addresses = '*'  # or specific IP
     ```

3. **Restart PostgreSQL Service:**
   ```powershell
   Restart-Service postgresql-x64-16
   ```

### Configure Windows Firewall for PostgreSQL

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "PostgreSQL" `
    -Direction Inbound `
    -LocalPort 5432 `
    -Protocol TCP `
    -Action Allow
```

---

## 📊 Step 3: Initialize Database Schema

1. **Connect to Database:**
   ```powershell
   cd "C:\Program Files\PostgreSQL\16\bin"
   psql -U office_app -d office_booking
   ```

2. **Run Schema Script:**
   ```powershell
   # From your project directory
   psql -U office_app -d office_booking -f postgresql-schema.sql
   ```

   Or copy the contents of `postgresql-schema.sql` and paste into psql.

3. **Verify Tables Created:**
   ```sql
   -- In psql
   \dt
   
   -- Should show:
   -- locations
   -- teams
   -- bookings
   -- public_holidays
   -- desks
   -- desk_bookings
   -- floor_elements
   -- settings
   ```

---

## ⚙️ Step 4: Update Application Configuration

### Install PostgreSQL Driver

```powershell
# In your project directory
npm install pg
npm uninstall @supabase/supabase-js  # Optional: remove Supabase if not needed
```

### Update Environment Variables

Edit your `.env` file:

```env
# PostgreSQL Configuration (Replace Supabase settings)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office_booking
DB_USER=office_app
DB_PASSWORD=your_secure_password_here

# Azure AD (Still required)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_TENANT_ID=your-tenant-id

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Update Database Config

The application will now use `config/postgresql.js` instead of `config/supabase.js` (see migration guide below).

---

## 🔄 Step 5: Migrate Application Code

See `POSTGRESQL-MIGRATION.md` for detailed code migration steps.

**Quick Summary:**
1. Replace `config/supabase.js` with `config/postgresql.js`
2. Update all route files to use PostgreSQL client
3. Test all endpoints

---

## 🧪 Step 6: Test Connection

```powershell
# Test PostgreSQL connection
node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', port: 5432, database: 'office_booking', user: 'office_app', password: 'your_password' }); pool.query('SELECT NOW()', (err, res) => { if (err) console.error(err); else console.log('Connected!', res.rows[0]); pool.end(); });"
```

---

## 🔒 Security Best Practices

### 1. Use Strong Passwords
- Database user password should be strong (16+ characters)
- Never commit passwords to version control

### 2. Limit Network Access
- Only allow PostgreSQL connections from trusted IPs
- Use firewall rules to restrict access

### 3. Regular Backups
```powershell
# Create backup
pg_dump -U office_app -d office_booking -F c -f backup.dump

# Restore backup
pg_restore -U office_app -d office_booking backup.dump
```

### 4. Update PostgreSQL Regularly
- Keep PostgreSQL updated with latest security patches
- Monitor PostgreSQL logs for suspicious activity

### 5. Use SSL (For Production)
- Configure SSL certificates for encrypted connections
- Update connection string to use SSL

---

## 📊 Monitoring PostgreSQL

### Check PostgreSQL Status

```powershell
# Check service status
Get-Service postgresql*

# View PostgreSQL logs
Get-Content "C:\Program Files\PostgreSQL\16\data\log\postgresql-*.log" -Tail 50
```

### Using pgAdmin (GUI Tool)

1. Open **pgAdmin** (installed with PostgreSQL)
2. Connect to server:
   - **Host:** localhost
   - **Port:** 5432
   - **Username:** postgres (or office_app)
   - **Password:** (your password)

3. Browse database, run queries, view tables

---

## 🔧 Troubleshooting

### PostgreSQL Service Won't Start

```powershell
# Check service status
Get-Service postgresql*

# View error logs
Get-Content "C:\Program Files\PostgreSQL\16\data\log\postgresql-*.log" -Tail 100

# Common issues:
# - Port 5432 already in use
# - Data directory permissions
# - Corrupted data files
```

### Connection Refused

1. **Check PostgreSQL is running:**
   ```powershell
   Get-Service postgresql*
   ```

2. **Check port is listening:**
   ```powershell
   netstat -an | findstr :5432
   ```

3. **Check firewall:**
   ```powershell
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*PostgreSQL*"}
   ```

### Authentication Failed

1. **Verify username/password:**
   ```powershell
   psql -U office_app -d office_booking
   ```

2. **Check `pg_hba.conf`** for authentication method

3. **Reset password if needed:**
   ```sql
   -- As postgres superuser
   ALTER USER office_app WITH PASSWORD 'new_password';
   ```

### Database Not Found

```sql
-- List all databases
\l

-- Create if missing
CREATE DATABASE office_booking;
```

---

## 📈 Performance Tuning

### PostgreSQL Configuration

Edit `postgresql.conf` (requires restart):

```conf
# Memory settings (adjust based on available RAM)
shared_buffers = 256MB          # 25% of RAM for small servers
effective_cache_size = 1GB       # 50-75% of RAM
maintenance_work_mem = 128MB
work_mem = 16MB

# Connection settings
max_connections = 100

# Logging
log_statement = 'all'            # For debugging (change to 'none' in production)
log_duration = on
```

### Restart PostgreSQL After Changes

```powershell
Restart-Service postgresql-x64-16
```

---

## ✅ Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `office_booking` created
- [ ] User `office_app` created with privileges
- [ ] Schema initialized (`postgresql-schema.sql` run)
- [ ] Windows Firewall configured (if needed)
- [ ] `.env` file updated with PostgreSQL credentials
- [ ] `pg` package installed (`npm install pg`)
- [ ] Application code migrated (see migration guide)
- [ ] Connection tested successfully
- [ ] All API endpoints tested

---

## 📚 Additional Resources

- [PostgreSQL Windows Documentation](https://www.postgresql.org/docs/current/installation-windows.html)
- [pgAdmin Documentation](https://www.pgadmin.org/docs/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

**🎉 PostgreSQL is now set up and ready to use!**

Next step: Follow `POSTGRESQL-MIGRATION.md` to update your application code.
