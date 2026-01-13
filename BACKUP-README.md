# 💾 Database Backup System

Automated PostgreSQL backup solution using OneDrive for Business.

---

## 🚀 Quick Start (3 Steps)

### 1. Run Setup (as Administrator)
```powershell
.\setup-backup-schedule.ps1
```

### 2. Verify It Works
```powershell
.\check-backup-status.ps1
```

### 3. Test Restore
```powershell
.\restore-database.ps1
```

**Done!** Daily backups at 2:00 AM to local disk + OneDrive cloud.

---

## 📁 What You Get

| File | Purpose |
|------|---------|
| **backup-database.ps1** | Main backup script (local + OneDrive) |
| **restore-database.ps1** | Interactive restore with backup selection |
| **setup-backup-schedule.ps1** | Creates Windows scheduled task |
| **check-backup-status.ps1** | Health check for backup system |
| **BACKUP-GUIDE.md** | Complete documentation (20+ pages) |

---

## 🔄 Common Tasks

### Check Status
```powershell
.\check-backup-status.ps1
```

### Manual Backup
```powershell
.\backup-database.ps1
```

### Restore Database
```powershell
.\restore-database.ps1
# Shows interactive menu of available backups
```

### View Backups
```powershell
# Local backups (7 days)
dir C:\backups\office-booking\local

# OneDrive backups (30 days)
dir "$env:OneDrive\Backups\OfficeSchedule"
```

---

## 📊 Backup Schedule

- **When:** Daily at 2:00 AM (configurable)
- **Where:** Local disk + OneDrive for Business
- **Retention:** 7 days local, 30 days cloud
- **Size:** ~2-5 MB per backup (compressed)

---

## ✅ What's Automated

- ✅ Daily database dump (compressed format)
- ✅ Copy to OneDrive (automatic cloud sync)
- ✅ Old backup cleanup (retention policy)
- ✅ Integrity verification
- ✅ Error logging
- ✅ Email notifications on failure (optional)

---

## 🆘 Emergency Recovery

If everything fails:

1. **Download from OneDrive Web:**
   - Go to [onedrive.live.com](https://onedrive.live.com)
   - Open `Backups/OfficeSchedule`
   - Download latest `.backup` file

2. **Restore manually:**
   ```powershell
   .\restore-database.ps1 -BackupFile "path\to\downloaded\backup.backup"
   ```

---

## 📚 Full Documentation

See **[BACKUP-GUIDE.md](BACKUP-GUIDE.md)** for:
- Detailed setup instructions
- Configuration options
- Troubleshooting guide
- Advanced features
- Security best practices
- Monthly maintenance checklist

---

## 💰 Cost

**$0** - Uses your existing OneDrive for Business storage (1 TB+ included with Microsoft 365 Enterprise)

---

## 🔐 Security

- ✅ Backups stored in your company's OneDrive
- ✅ Encrypted in transit (HTTPS)
- ✅ Encrypted at rest (OneDrive encryption)
- ✅ Password not stored in scripts (uses .env)
- ✅ Version history available (OneDrive)

---

## 📞 Need Help?

1. Run health check: `.\check-backup-status.ps1`
2. Check logs: `C:\backups\office-booking\local\backup.log`
3. Read guide: `BACKUP-GUIDE.md`
4. Test restore: `.\restore-database.ps1`

---

**Your database is now protected with automated cloud backups!** ☁️
