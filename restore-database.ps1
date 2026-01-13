# Office Booking System - Database Restore Script
# Restores PostgreSQL database from backup file
# Author: Claude Code
# Usage: .\restore-database.ps1 -BackupFile "path\to\backup.backup"

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile,
    [string]$PostgreSQLBin = "C:\Program Files\PostgreSQL\16\bin",
    [string]$DBName = "office_booking",
    [string]$DBUser = "office_app",
    [string]$DBSuperUser = "postgres",
    [switch]$CreateNewDatabase = $false,
    [switch]$Force = $false
)

# Color-coded logging
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"

    switch ($Level) {
        "SUCCESS" { Write-Host $LogMessage -ForegroundColor Green }
        "ERROR"   { Write-Host $LogMessage -ForegroundColor Red }
        "WARNING" { Write-Host $LogMessage -ForegroundColor Yellow }
        "INFO"    { Write-Host $LogMessage -ForegroundColor Cyan }
        default   { Write-Host $LogMessage }
    }
}

# List available backups
function Get-AvailableBackups {
    Write-Log "Available backups:" "INFO"
    Write-Log "" "INFO"

    $Backups = @()

    # Local backups
    $LocalPath = "C:\backups\office-booking\local"
    if (Test-Path $LocalPath) {
        $LocalBackups = Get-ChildItem -Path $LocalPath -Filter "*.backup" |
            Sort-Object LastWriteTime -Descending

        Write-Log "Local backups ($LocalPath):" "INFO"
        foreach ($Backup in $LocalBackups) {
            $Size = [math]::Round($Backup.Length / 1MB, 2)
            $Age = (Get-Date) - $Backup.LastWriteTime
            Write-Log "  [$($Backups.Count + 1)] $($Backup.Name) - $Size MB - $([math]::Round($Age.TotalDays, 1)) days old" "INFO"
            $Backups += $Backup.FullName
        }
    }

    # OneDrive backups
    $OneDrivePath = "$env:OneDrive\Backups\OfficeSchedule"
    if (Test-Path $OneDrivePath) {
        $OneDriveBackups = Get-ChildItem -Path $OneDrivePath -Filter "*.backup" |
            Sort-Object LastWriteTime -Descending

        Write-Log "" "INFO"
        Write-Log "OneDrive backups ($OneDrivePath):" "INFO"
        foreach ($Backup in $OneDriveBackups) {
            $Size = [math]::Round($Backup.Length / 1MB, 2)
            $Age = (Get-Date) - $Backup.LastWriteTime
            Write-Log "  [$($Backups.Count + 1)] $($Backup.Name) - $Size MB - $([math]::Round($Age.TotalDays, 1)) days old" "INFO"
            $Backups += $Backup.FullName
        }
    }

    return $Backups
}

# Main restore function
function Start-DatabaseRestore {
    param([string]$BackupFilePath)

    Write-Log "========================================" "INFO"
    Write-Log "Office Booking Database Restore" "INFO"
    Write-Log "========================================" "INFO"

    # Validate backup file
    if (-not (Test-Path $BackupFilePath)) {
        Write-Log "Backup file not found: $BackupFilePath" "ERROR"
        return $false
    }

    $BackupFileInfo = Get-Item $BackupFilePath
    $BackupSize = [math]::Round($BackupFileInfo.Length / 1MB, 2)
    Write-Log "Backup file: $BackupFilePath" "INFO"
    Write-Log "Backup size: $BackupSize MB" "INFO"
    Write-Log "Backup date: $($BackupFileInfo.LastWriteTime)" "INFO"

    # Validate PostgreSQL binaries
    if (-not (Test-Path "$PostgreSQLBin\pg_restore.exe")) {
        Write-Log "PostgreSQL binaries not found at: $PostgreSQLBin" "ERROR"
        return $false
    }

    # Check database password
    if (-not $env:DB_PASSWORD) {
        Write-Log "DB_PASSWORD environment variable not set!" "ERROR"
        return $false
    }

    # Warning prompt (unless -Force)
    if (-not $Force) {
        Write-Log "" "WARNING"
        Write-Log "⚠️  WARNING: This will OVERWRITE the existing database!" "WARNING"
        Write-Log "⚠️  All current data will be REPLACED with backup data!" "WARNING"
        Write-Log "" "WARNING"
        $Confirm = Read-Host "Type 'YES' to continue or anything else to cancel"

        if ($Confirm -ne "YES") {
            Write-Log "Restore cancelled by user" "INFO"
            return $false
        }
    }

    $StartTime = Get-Date

    # Set password for PostgreSQL commands
    $env:PGPASSWORD = $env:DB_PASSWORD

    try {
        # Step 1: Terminate existing connections
        Write-Log "Terminating existing database connections..." "INFO"

        $env:PGPASSWORD = $env:DB_PASSWORD
        & "$PostgreSQLBin\psql.exe" `
            -U $DBUser `
            -d postgres `
            -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DBName' AND pid <> pg_backend_pid();" `
            2>&1 | Out-Null

        Write-Log "Connections terminated" "SUCCESS"

        # Step 2: Drop and recreate database (if requested)
        if ($CreateNewDatabase) {
            Write-Log "Dropping existing database..." "WARNING"

            # Switch to superuser for database drop/create
            $env:PGPASSWORD = Read-Host -Prompt "Enter PostgreSQL superuser (postgres) password" -AsSecureString
            $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:PGPASSWORD)
            )

            & "$PostgreSQLBin\psql.exe" `
                -U $DBSuperUser `
                -d postgres `
                -c "DROP DATABASE IF EXISTS $DBName;" `
                2>&1 | Out-Null

            Write-Log "Creating fresh database..." "INFO"

            & "$PostgreSQLBin\psql.exe" `
                -U $DBSuperUser `
                -d postgres `
                -c "CREATE DATABASE $DBName OWNER $DBUser;" `
                2>&1 | Out-Null

            Write-Log "Database recreated" "SUCCESS"

            # Switch back to application user
            $env:PGPASSWORD = $env:DB_PASSWORD
        }

        # Step 3: Restore backup
        Write-Log "Restoring database from backup..." "INFO"

        & "$PostgreSQLBin\pg_restore.exe" `
            -U $DBUser `
            -d $DBName `
            --clean `
            --if-exists `
            --no-owner `
            --no-privileges `
            $BackupFilePath `
            2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Log "Database restored successfully" "SUCCESS"
        } else {
            throw "pg_restore failed with exit code $LASTEXITCODE"
        }

        # Step 4: Verify restore
        Write-Log "Verifying restored data..." "INFO"

        $TableCount = & "$PostgreSQLBin\psql.exe" `
            -U $DBUser `
            -d $DBName `
            -t `
            -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" `
            2>&1

        $TableCount = $TableCount.Trim()

        if ($TableCount -gt 0) {
            Write-Log "Verified: $TableCount tables restored" "SUCCESS"
        } else {
            throw "No tables found after restore"
        }

        # Show table counts
        Write-Log "Table row counts:" "INFO"
        $Tables = @('locations', 'teams', 'bookings', 'desks', 'desk_bookings', 'floor_elements', 'public_holidays', 'settings')

        foreach ($Table in $Tables) {
            $Count = & "$PostgreSQLBin\psql.exe" `
                -U $DBUser `
                -d $DBName `
                -t `
                -c "SELECT COUNT(*) FROM $Table;" `
                2>&1 | Out-Null

            $Count = $Count.Trim()
            Write-Log "  - $Table: $Count rows" "INFO"
        }

        # Success summary
        $Duration = (Get-Date) - $StartTime
        Write-Log "========================================" "INFO"
        Write-Log "Restore completed successfully!" "SUCCESS"
        Write-Log "Duration: $([math]::Round($Duration.TotalSeconds, 2)) seconds" "INFO"
        Write-Log "========================================" "INFO"

        return $true

    } catch {
        Write-Log "Restore failed: $_" "ERROR"
        return $false
    } finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# Main script execution
try {
    # Load environment variables from .env file
    $EnvFile = Join-Path $PSScriptRoot ".env"
    if (Test-Path $EnvFile) {
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
                $Key = $matches[1].Trim()
                $Value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($Key, $Value, "Process")
            }
        }
    }

    # If no backup file specified, show available backups
    if (-not $BackupFile) {
        $Backups = Get-AvailableBackups

        if ($Backups.Count -eq 0) {
            Write-Log "No backup files found" "ERROR"
            exit 1
        }

        Write-Log "" "INFO"
        $Selection = Read-Host "Enter backup number to restore (or 'q' to quit)"

        if ($Selection -eq 'q') {
            Write-Log "Restore cancelled" "INFO"
            exit 0
        }

        $SelectedIndex = [int]$Selection - 1
        if ($SelectedIndex -ge 0 -and $SelectedIndex -lt $Backups.Count) {
            $BackupFile = $Backups[$SelectedIndex]
        } else {
            Write-Log "Invalid selection" "ERROR"
            exit 1
        }
    }

    # Restore database
    $Result = Start-DatabaseRestore -BackupFilePath $BackupFile

    if ($Result) {
        exit 0
    } else {
        exit 1
    }

} catch {
    Write-Log "Fatal error: $_" "ERROR"
    exit 1
}
