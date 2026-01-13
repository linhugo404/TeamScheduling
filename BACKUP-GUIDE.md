# 💾 Database Backup & Restore Guide

Complete guide for backing up and restoring the Office Booking PostgreSQL database using OneDrive for Business.

---

## 📋 Overview

This backup solution provides:
- ✅ **Automated daily backups** via Windows Task Scheduler
- ✅ **Dual storage**: Local disk (7 days) + OneDrive cloud (30 days)
- ✅ **Automatic retention policies** (cleanup old backups)
- ✅ **Email notifications** on failure (optional)
- ✅ **Integrity verification** after each backup
- ✅ **Easy restore** with interactive menu
- ✅ **No additional cost** (uses your existing OneDrive for Business)

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install OneDrive (if not already installed)

OneDrive is usually pre-installed on Windows. Verify:

```powershell
# Check if OneDrive is running
Get-Process -Name OneDrive -ErrorAction SilentlyContinue

# Check OneDrive folder
Test-Path $env:OneDrive
```

If not installed, download from [Microsoft OneDrive](https://www.microsoft.com/microsoft-365/onedrive/download).

### Step 2: Run Automated Setup

```powershell
# Open PowerShell as Administrator
cd C:\apps\office-booking  # or your installation directory

# Run setup script
.\setup-backup-schedule.ps1
```

This will:
- ✅ Create backup directories
- ✅ Set up daily scheduled task (runs at 2:00 AM)
- ✅ Optionally run a test backup

### Step 3: Verify Setup

```powershell
# Check scheduled task
Get-ScheduledTask -TaskName "Office Booking Database Backup"

# Check backup directories
dir C:\backups\office-booking\local
dir "$env:OneDrive\Backups\OfficeSchedule"
```

**Done!** Your database will now backup automatically every day.

---

## 📂 Backup Locations

| Location | Path | Retention | Purpose |
|----------|------|-----------|---------|
| **Local** | `C:\backups\office-booking\local` | 7 days | Fast recovery, recent backups |
| **OneDrive** | `%OneDrive%\Backups\OfficeSchedule` | 30 days | Cloud backup, offsite storage |
| **Logs** | `C:\backups\office-booking\local\backup.log` | - | Backup history and errors |

---

## 🔄 Manual Backup

To run a backup manually:

```powershell
# Run backup script directly
.\backup-database.ps1

# Or trigger the scheduled task
Start-ScheduledTask -TaskName "Office Booking Database Backup"
```

### Backup to Custom Location

```powershell
.\backup-database.ps1 `
    -LocalBackupDir "D:\Backups\Local" `
    -OneDriveBackupDir "$env:OneDrive\CustomBackup"
```

### Change Retention Policies

```powershell
.\backup-database.ps1 `
    -LocalRetentionDays 14 `
    -OneDriveRetentionDays 90
```

---

## 🔙 Restore Database

### Interactive Restore (Easiest)

```powershell
# Run restore script (shows backup menu)
.\restore-database.ps1
```

**Output:**
```
Available backups:

Local backups (C:\backups\office-booking\local):
  [1] office_booking_20240115_020000.backup - 2.5 MB - 0.1 days old
  [2] office_booking_20240114_020000.backup - 2.4 MB - 1.1 days old

OneDrive backups (%OneDrive%\Backups\OfficeSchedule):
  [3] office_booking_20240115_020000.backup - 2.5 MB - 0.1 days old
  [4] office_booking_20240110_020000.backup - 2.3 MB - 5.1 days old

Enter backup number to restore (or 'q' to quit):
```

Select a backup number and confirm.

### Restore Specific Backup File

```powershell
.\restore-database.ps1 -BackupFile "C:\backups\office-booking\local\office_booking_20240115_020000.backup"
```

### Restore Without Confirmation (Automation)

```powershell
.\restore-database.ps1 -BackupFile "path\to\backup.backup" -Force
```

### Restore to Fresh Database

```powershell
# Drops and recreates database before restore
.\restore-database.ps1 -BackupFile "path\to\backup.backup" -CreateNewDatabase
```

---

## ⚙️ Configuration

### Environment Variables

The backup scripts use these variables from your `.env` file:

```env
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office_booking
DB_USER=office_app
DB_PASSWORD=your_secure_password_here
```

### Email Notifications (Optional)

To enable email alerts on backup failure:

```powershell
.\backup-database.ps1 `
    -SMTPServer "smtp.office365.com" `
    -EmailFrom "alerts@yourcompany.com" `
    -EmailTo "admin@yourcompany.com" `
    -SendEmailOnSuccess  # Optional: also email on success
```

**Note:** For Office 365 SMTP, you may need to create an app password.

### Custom Backup Schedule

Edit the scheduled task to change backup time:

```powershell
# Get current task
$Task = Get-ScheduledTask -TaskName "Office Booking Database Backup"

# Create new trigger (e.g., 3:30 AM)
$NewTrigger = New-ScheduledTaskTrigger -Daily -At "03:30"

# Update task
Set-ScheduledTask -TaskName "Office Booking Database Backup" -Trigger $NewTrigger
```

Or use Task Scheduler GUI:
1. Open Task Scheduler (`taskschd.msc`)
2. Find "Office Booking Database Backup"
3. Right-click → Properties → Triggers → Edit

---

## 📊 Monitoring Backups

### Check Latest Backup

```powershell
# View latest local backup
Get-ChildItem "C:\backups\office-booking\local" -Filter "*.backup" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 |
    Format-List Name, LastWriteTime, @{Name="Size (MB)"; Expression={[math]::Round($_.Length/1MB, 2)}}
```

### Check Backup Logs

```powershell
# View recent backup log entries
Get-Content "C:\backups\office-booking\local\backup.log" -Tail 50
```

### Check OneDrive Sync Status

```powershell
# Check if OneDrive is syncing
Get-Process -Name OneDrive

# Check OneDrive folder
dir "$env:OneDrive\Backups\OfficeSchedule"
```

### Alert if Backup is Old

```powershell
# Alert if no backup in last 26 hours
$LatestBackup = Get-ChildItem "C:\backups\office-booking\local" -Filter "*.backup" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$Age = (Get-Date) - $LatestBackup.LastWriteTime

if ($Age.TotalHours -gt 26) {
    Write-Host "⚠️ WARNING: Latest backup is $([math]::Round($Age.TotalHours, 1)) hours old!" -ForegroundColor Red
} else {
    Write-Host "✓ Backups are current" -ForegroundColor Green
}
```

---

## 🧪 Testing Backups

### Test Backup Integrity

```powershell
# Verify backup file structure
$BackupFile = "C:\backups\office-booking\local\office_booking_20240115_020000.backup"
$env:PGPASSWORD = $env:DB_PASSWORD
pg_restore --list $BackupFile
Remove-Item Env:\PGPASSWORD
```

### Test Restore to Temporary Database

```powershell
# Create test database
psql -U postgres -c "CREATE DATABASE office_booking_test;"

# Restore backup
$env:PGPASSWORD = $env:DB_PASSWORD
pg_restore -U office_app -d office_booking_test $BackupFile
Remove-Item Env:\PGPASSWORD

# Verify data
psql -U office_app -d office_booking_test -c "SELECT COUNT(*) FROM bookings;"

# Clean up
psql -U postgres -c "DROP DATABASE office_booking_test;"
```

### Monthly Backup Test (Recommended)

```powershell
# Add this to your monthly maintenance checklist
1. Run: .\restore-database.ps1
2. Select oldest backup
3. Restore to test database
4. Verify data integrity
5. Document test results
```

---

## 🚨 Troubleshooting

### Backup Failed: "DB_PASSWORD not set"

**Solution:** Add `DB_PASSWORD` to your `.env` file or set as system environment variable.

```powershell
# Add to .env file
DB_PASSWORD=your_password

# Or set system environment variable (requires restart)
[System.Environment]::SetEnvironmentVariable("DB_PASSWORD", "your_password", "Machine")
```

### OneDrive Not Syncing

**Check OneDrive status:**
```powershell
# Open OneDrive settings
start ms-settings:onedrive
```

**Restart OneDrive:**
```powershell
Stop-Process -Name OneDrive -Force
Start-Process "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"
```

### Scheduled Task Not Running

**Check task status:**
```powershell
Get-ScheduledTask -TaskName "Office Booking Database Backup" | Get-ScheduledTaskInfo
```

**Check task history:**
1. Open Task Scheduler (`taskschd.msc`)
2. Find task → History tab
3. Look for error events

**Common issues:**
- PowerShell execution policy (script sets `-ExecutionPolicy Bypass`)
- Incorrect working directory (script uses `$PSScriptRoot`)
- Missing .env file (ensure `.env` is in script directory)

### Restore Failed: "Database in use"

**Solution:** Stop the application first.

```powershell
# If using PM2
pm2 stop office-booking

# If using direct node
Stop-Process -Name node -Force

# Then restore
.\restore-database.ps1 -BackupFile "path\to\backup.backup"

# Restart application
pm2 start office-booking
```

### Backup File Corrupted

**Verify integrity:**
```powershell
pg_restore --list $BackupFile
```

**If corrupted:** Restore from older backup or OneDrive version history:
1. Open OneDrive folder in web browser
2. Right-click backup file → Version history
3. Restore previous version

---

## 🔐 Security Best Practices

### 1. Protect Backup Files

```powershell
# Set NTFS permissions (only Administrators can access)
$BackupDir = "C:\backups\office-booking"
icacls $BackupDir /inheritance:r
icacls $BackupDir /grant "Administrators:(OI)(CI)F"
icacls $BackupDir /grant "SYSTEM:(OI)(CI)F"
```

### 2. Encrypt Backups (Optional)

For sensitive data, encrypt backups before uploading to OneDrive:

```powershell
# Install 7-Zip
choco install 7zip

# Encrypt backup with password
7z a -p -mhe=on "backup_encrypted.7z" "backup.backup"
```

### 3. Secure Database Password

Don't hardcode passwords in scripts. Use:
- Windows Credential Manager
- `.pgpass` file with restricted permissions
- Environment variables from `.env` (already implemented)

### 4. Monitor Backup Access

Enable OneDrive activity alerts:
1. Go to [OneDrive settings](https://onedrive.live.com/options/ManageStorage)
2. Enable alerts for file access/downloads

---

## 📈 Backup Storage Planning

### Estimate Backup Size

```powershell
# Check current database size
psql -U office_app -d office_booking -c "SELECT pg_size_pretty(pg_database_size('office_booking'));"
```

### Storage Requirements

| Scenario | Database Size | Backups/Month | Storage Needed |
|----------|---------------|---------------|----------------|
| **Small** | 100 MB | 30 daily | ~3 GB (OneDrive) |
| **Medium** | 500 MB | 30 daily | ~15 GB (OneDrive) |
| **Large** | 2 GB | 30 daily | ~60 GB (OneDrive) |

**OneDrive for Business:** 1 TB per user (plenty for backups!)

---

## 📚 Advanced Options

### Backup Specific Tables Only

```powershell
# Backup only bookings table
pg_dump -U office_app -d office_booking -t bookings -F c -f bookings_backup.backup
```

### Backup Schema Only (No Data)

```powershell
# Useful for version control
pg_dump -U office_app -d office_booking --schema-only -f schema_only.sql
```

### Compressed SQL Format

```powershell
# Human-readable SQL with compression
pg_dump -U office_app -d office_booking | gzip > backup.sql.gz
```

### Continuous Archiving (Point-in-Time Recovery)

For advanced users, enable WAL archiving in `postgresql.conf`:

```conf
wal_level = replica
archive_mode = on
archive_command = 'copy "%p" "C:\\backups\\wal\\%f"'
```

This allows recovery to any specific timestamp.

---

## ✅ Backup Checklist

**Initial Setup:**
- [ ] OneDrive for Business installed and syncing
- [ ] Backup scripts in place (`backup-database.ps1`, `restore-database.ps1`)
- [ ] Scheduled task created and enabled
- [ ] Test backup completed successfully
- [ ] Test restore completed successfully
- [ ] Backup directories have correct permissions
- [ ] `.env` file contains `DB_PASSWORD`

**Monthly Maintenance:**
- [ ] Verify latest backup exists and is recent (< 26 hours)
- [ ] Check OneDrive sync status
- [ ] Test restore from oldest backup
- [ ] Review backup logs for errors
- [ ] Verify backup storage space available
- [ ] Update backup retention policies if needed

**Disaster Recovery Plan:**
- [ ] Document restore procedure
- [ ] Test full recovery scenario quarterly
- [ ] Keep copy of restore script offline
- [ ] Document PostgreSQL admin credentials
- [ ] List all dependencies (OneDrive, .env, PostgreSQL version)

---

## 🆘 Emergency Recovery

If everything fails and you need to recover:

1. **Access OneDrive Web:**
   - Go to [onedrive.live.com](https://onedrive.live.com)
   - Navigate to `Backups/OfficeSchedule`
   - Download latest backup file

2. **Manual Restore:**
   ```powershell
   # Set password
   $env:PGPASSWORD = "your_password"

   # Restore
   pg_restore -U office_app -d office_booking --clean --if-exists "path\to\downloaded\backup.backup"

   # Clean up
   Remove-Item Env:\PGPASSWORD
   ```

3. **Verify:**
   ```powershell
   psql -U office_app -d office_booking -c "SELECT COUNT(*) FROM bookings;"
   ```

---

## 📞 Support Resources

- **Backup Scripts:** `backup-database.ps1`, `restore-database.ps1`
- **Setup Script:** `setup-backup-schedule.ps1`
- **Backup Logs:** `C:\backups\office-booking\local\backup.log`
- **PostgreSQL Docs:** [postgresql.org/docs](https://www.postgresql.org/docs/)
- **OneDrive Help:** [Microsoft OneDrive Support](https://support.microsoft.com/onedrive)

---

**🎉 Your database backups are now automated and secure!**

Backups run daily at 2:00 AM and sync to OneDrive automatically.
