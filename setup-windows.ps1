# Office Booking System - Windows Setup Script
# Run this script as Administrator for full setup

param(
    [switch]$SkipFirewall,
    [switch]$SkipPM2,
    [string]$Port = "3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Office Booking System - Windows Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin -and -not $SkipFirewall) {
    Write-Host "⚠️  Warning: Not running as Administrator. Firewall rules will be skipped." -ForegroundColor Yellow
    Write-Host "   Run this script as Administrator to configure firewall automatically." -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Check Node.js
Write-Host "📦 Checking Node.js installation..." -ForegroundColor Green
try {
    $nodeVersion = node --version
    Write-Host "   ✓ Node.js found: $nodeVersion" -ForegroundColor Green
    
    # Check if version is 18+
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Host "   ⚠️  Warning: Node.js 18+ recommended. Current: $nodeVersion" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Node.js not found!" -ForegroundColor Red
    Write-Host "   Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Step 2: Check npm
Write-Host "📦 Checking npm installation..." -ForegroundColor Green
try {
    $npmVersion = npm --version
    Write-Host "   ✓ npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ npm not found!" -ForegroundColor Red
    exit 1
}

# Step 3: Check if .env exists
Write-Host "⚙️  Checking environment configuration..." -ForegroundColor Green
if (Test-Path ".env") {
    Write-Host "   ✓ .env file found" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  .env file not found!" -ForegroundColor Yellow
    Write-Host "   Creating template .env file..." -ForegroundColor Yellow
    
    $envTemplate = @"
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key

# Azure AD (Required for authentication)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_TENANT_ID=your-tenant-id

# Server Configuration
PORT=$Port
NODE_ENV=production
"@
    
    Set-Content -Path ".env" -Value $envTemplate
    Write-Host "   ✓ Template .env created. Please edit it with your credentials!" -ForegroundColor Green
}

# Step 4: Install dependencies
Write-Host "📥 Installing dependencies..." -ForegroundColor Green
npm install --production
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "   ✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 5: Configure Windows Firewall
if ($isAdmin -and -not $SkipFirewall) {
    Write-Host "🔥 Configuring Windows Firewall..." -ForegroundColor Green
    try {
        $rule = Get-NetFirewallRule -DisplayName "Office Booking System" -ErrorAction SilentlyContinue
        if ($rule) {
            Write-Host "   ✓ Firewall rule already exists" -ForegroundColor Green
        } else {
            New-NetFirewallRule -DisplayName "Office Booking System" `
                -Direction Inbound `
                -LocalPort $Port `
                -Protocol TCP `
                -Action Allow `
                -ErrorAction Stop | Out-Null
            Write-Host "   ✓ Firewall rule created for port $Port" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⚠️  Failed to configure firewall: $_" -ForegroundColor Yellow
    }
} elseif (-not $SkipFirewall) {
    Write-Host "🔥 Skipping firewall configuration (not running as Administrator)" -ForegroundColor Yellow
}

# Step 6: Install PM2 (optional)
if (-not $SkipPM2) {
    Write-Host "🚀 Installing PM2 (process manager)..." -ForegroundColor Green
    $pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
    if ($pm2Installed) {
        Write-Host "   ✓ PM2 already installed" -ForegroundColor Green
    } else {
        Write-Host "   Installing PM2 globally..." -ForegroundColor Yellow
        npm install -g pm2 pm2-windows-startup
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✓ PM2 installed successfully" -ForegroundColor Green
            Write-Host "   Run 'pm2-startup install' to enable auto-start on boot" -ForegroundColor Cyan
        } else {
            Write-Host "   ⚠️  Failed to install PM2 (optional, continuing...)" -ForegroundColor Yellow
        }
    }
}

# Step 7: Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit .env file with your credentials" -ForegroundColor White
Write-Host "2. Initialize database (run supabase-schema.sql in Supabase)" -ForegroundColor White
Write-Host "3. Configure Azure AD redirect URIs" -ForegroundColor White
Write-Host "4. Start the application:" -ForegroundColor White
Write-Host ""
Write-Host "   Option A (PM2):" -ForegroundColor Cyan
Write-Host "   pm2 start server.js --name office-booking" -ForegroundColor Gray
Write-Host ""
Write-Host "   Option B (Direct):" -ForegroundColor Cyan
Write-Host "   `$env:NODE_ENV='production'; node server.js" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Access at: http://localhost:$Port" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see WINDOWS-DEPLOYMENT.md" -ForegroundColor Gray
Write-Host ""
