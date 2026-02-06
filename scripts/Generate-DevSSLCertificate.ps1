<#
.SYNOPSIS
    Generate self-signed SSL certificate for Socket.IO development server
.DESCRIPTION
    Creates a self-signed certificate, exports it for use in Node.js, and installs it in Windows certificate store
.PARAMETER DnsName
    DNS names for the certificate (default: localhost, 127.0.0.1, ::1)
.PARAMETER OutputPath
    Path to save certificate files (default: config/ssl)
.PARAMETER ValidityYears
    Certificate validity in years (default: 2)
#>

param(
    [string[]]$DnsName = @("localhost", "127.0.0.1", "::1"),
    [string]$OutputPath = "config\ssl",
    [int]$ValidityYears = 2
)

$ErrorActionPreference = "Stop"

Write-Host "[SSL] Generating Self-Signed SSL Certificate for Socket.IO Server" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

# Resolve full output path
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$projectRoot = Split-Path -Parent $scriptRoot

if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath = Join-Path $projectRoot $OutputPath
}

# Also create copy in script directory for manual operations
$scriptOutputPath = Join-Path $scriptRoot "generated-certificates"

# Create output directories if they don't exist
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
    Write-Host "[OK] Created directory: $OutputPath" -ForegroundColor Green
}

if (-not (Test-Path $scriptOutputPath)) {
    New-Item -ItemType Directory -Path $scriptOutputPath -Force | Out-Null
    Write-Host "[OK] Created script directory: $scriptOutputPath" -ForegroundColor Green
}

# Certificate parameters
$certName = "Application Socket.IO Development Certificate"
$notAfter = (Get-Date).AddYears($ValidityYears)

Write-Host "`n[INFO] Certificate Configuration:" -ForegroundColor Yellow
Write-Host "   Subject: $certName"
Write-Host "   DNS Names: $($DnsName -join ', ')"
Write-Host "   Valid Until: $($notAfter.ToString('yyyy-MM-dd'))"
Write-Host "   Output Path: $OutputPath"

# Generate self-signed certificate
Write-Host "`n[WORK] Generating certificate..." -ForegroundColor Yellow

try {
    $cert = New-SelfSignedCertificate `
        -Subject "CN=$certName" `
        -DnsName $DnsName `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -NotAfter $notAfter `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -FriendlyName $certName `
        -HashAlgorithm SHA256 `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")
    
    Write-Host "[OK] Certificate generated successfully" -ForegroundColor Green
    Write-Host "   Thumbprint: $($cert.Thumbprint)" -ForegroundColor Gray
    
} catch {
    Write-Host "[ERROR] Failed to generate certificate: $_" -ForegroundColor Red
    exit 1
}

# Export certificate and private key for Node.js
Write-Host "`n[WORK] Exporting certificate files..." -ForegroundColor Yellow

$certPath = Join-Path $OutputPath "certificate.crt"
$keyPath = Join-Path $OutputPath "private.key"
$pfxPath = Join-Path $OutputPath "certificate.pfx"
$pemPath = Join-Path $OutputPath "certificate.pem"

# Generate random password for PFX
$pfxPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$securePassword = ConvertTo-SecureString -String $pfxPassword -Force -AsPlainText

try {
    # Export to PFX (contains both cert and private key)
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
    Write-Host "[OK] Exported PFX: $pfxPath" -ForegroundColor Green
    
    # Copy to script directory
    $scriptPfxPath = Join-Path $scriptOutputPath "certificate.pfx"
    Export-PfxCertificate -Cert $cert -FilePath $scriptPfxPath -Password $securePassword | Out-Null
    
    # Save PFX password to file in script directory
    $scriptPasswordPath = Join-Path $scriptOutputPath "pfx-password.txt"
    $pfxPassword | Out-File -FilePath $scriptPasswordPath -Encoding ASCII -NoNewline
    
    # Export certificate (public key) to PEM format
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $certPem = "-----BEGIN CERTIFICATE-----`n"
    $certPem += [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
    $certPem += "`n-----END CERTIFICATE-----"
    $certPem | Out-File -FilePath $certPath -Encoding ASCII
    $certPem | Out-File -FilePath $pemPath -Encoding ASCII
    Write-Host "[OK] Exported certificate: $certPath" -ForegroundColor Green
    
    # Copy to script directory
    $scriptCertPath = Join-Path $scriptOutputPath "certificate.crt"
    $scriptPemPath = Join-Path $scriptOutputPath "certificate.pem"
    $certPem | Out-File -FilePath $scriptCertPath -Encoding ASCII
    $certPem | Out-File -FilePath $scriptPemPath -Encoding ASCII
    
    # Extract private key from PFX using OpenSSL (if available)
    $opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
    
    if ($opensslPath) {
        # Use OpenSSL to extract private key
        $env:OPENSSL_CONF = $null
        
        # Create temporary password file
        $tempPwdFile = Join-Path $env:TEMP "ssl_pwd_$([Guid]::NewGuid().ToString('N')).txt"
        $pfxPassword | Out-File -FilePath $tempPwdFile -Encoding ASCII -NoNewline
        
        try {
            # Extract private key
            & openssl pkcs12 -in $pfxPath -nocerts -nodes -passin "file:$tempPwdFile" -out $keyPath 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] Exported private key: $keyPath" -ForegroundColor Green
                
                # Copy to script directory
                $scriptKeyPath = Join-Path $scriptOutputPath "private.key"
                Copy-Item $keyPath $scriptKeyPath -Force
            } else {
                throw "OpenSSL extraction failed"
            }
        } finally {
            Remove-Item $tempPwdFile -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "[WARN] OpenSSL not found - using alternative method" -ForegroundColor Yellow
        
        # Alternative: Use .NET to extract private key (compatible with older PowerShell)
        $pfxCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxPath, $pfxPassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
        
        # Get RSA private key
        $rsa = $pfxCert.PrivateKey
        
        if ($rsa -is [System.Security.Cryptography.RSACryptoServiceProvider]) {
            # Export private key parameters
            $privateKeyParams = $rsa.ExportParameters($true)
            
            # Convert to PEM format manually
            Add-Type -AssemblyName System.Security
            $rsaKey = New-Object System.Security.Cryptography.RSACryptoServiceProvider
            $rsaKey.ImportParameters($privateKeyParams)
            
            # Export to XML then convert to PEM-like format
            $privateKeyXml = $rsaKey.ToXmlString($true)
            
            # Use certutil to convert PFX to PEM (Windows built-in)
            $tempPemFile = Join-Path $env:TEMP "temp_key_$([Guid]::NewGuid().ToString('N')).pem"
            
            try {
                # Try using certutil (available on Windows)
                $null = certutil -exportPFX -p $pfxPassword -privatekey $pfxPath $tempPemFile 2>$null
                
                if (Test-Path $tempPemFile) {
                    $pemContent = Get-Content $tempPemFile -Raw
                    
                    # Extract just the private key section
                    if ($pemContent -match '(?s)(-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----)|(-----BEGIN RSA PRIVATE KEY-----.*?-----END RSA PRIVATE KEY-----)') {
                        $matches[0] | Out-File -FilePath $keyPath -Encoding ASCII
                        Write-Host "[OK] Exported private key: $keyPath" -ForegroundColor Green
                        
                        # Copy to script directory
                        $scriptKeyPath = Join-Path $scriptOutputPath "private.key"
                        $matches[0] | Out-File -FilePath $scriptKeyPath -Encoding ASCII
                    } else {
                        throw "Could not extract private key from PEM"
                    }
                } else {
                    throw "Certutil failed to export"
                }
            } catch {
                Write-Host "[WARN] Built-in methods failed. Please install OpenSSL for proper key export." -ForegroundColor Yellow
                Write-Host "[INFO] You can use the PFX file directly or extract the key manually." -ForegroundColor Cyan
                Write-Host "       PFX file: $pfxPath" -ForegroundColor Cyan
                Write-Host "       Password: $pfxPassword" -ForegroundColor Cyan
                
                # Create a readme file with instructions
                $readmePath = Join-Path $scriptOutputPath "HOW-TO-EXTRACT-KEY.txt"
                @"
To extract the private key from the PFX file, use one of these methods:

METHOD 1: Install OpenSSL and run:
openssl pkcs12 -in certificate.pfx -nocerts -nodes -out private.key
Password: $pfxPassword

METHOD 2: Use the PFX directly in your application
Many applications can read PFX files directly without extracting the key.

METHOD 3: Install OpenSSL for Windows from:
https://slproweb.com/products/Win32OpenSSL.html

Then re-run this script.
"@ | Out-File -FilePath $readmePath -Encoding ASCII
                
                Write-Host "[INFO] Instructions saved to: $readmePath" -ForegroundColor Cyan
            } finally {
                if (Test-Path $tempPemFile) {
                    Remove-Item $tempPemFile -Force -ErrorAction SilentlyContinue
                }
            }
        } else {
            Write-Host "[WARN] Unsupported key type. OpenSSL required for private key export." -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "[ERROR] Failed to export certificate files: $_" -ForegroundColor Red
    Write-Host "[WARN] Certificate is installed in Windows store but files may be incomplete" -ForegroundColor Yellow
}

# Ensure private key was copied to script directory
if ((Test-Path $keyPath) -and -not (Test-Path (Join-Path $scriptOutputPath "private.key"))) {
    $scriptKeyPath = Join-Path $scriptOutputPath "private.key"
    Copy-Item $keyPath $scriptKeyPath -Force
    Write-Host "[OK] Copied private key to script directory" -ForegroundColor Green
}

# Install certificate in Trusted Root Certification Authorities
Write-Host "`n[WORK] Installing certificate in Windows certificate store..." -ForegroundColor Yellow

try {
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
        [System.Security.Cryptography.X509Certificates.StoreName]::Root,
        [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
    )
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($cert)
    $store.Close()
    
    Write-Host "[OK] Certificate installed in Trusted Root Certification Authorities" -ForegroundColor Green
    Write-Host "   Location: Cert:\CurrentUser\Root\$($cert.Thumbprint)" -ForegroundColor Gray
    
} catch {
    Write-Host "[WARN] Could not install to Root store: $_" -ForegroundColor Yellow
    Write-Host "   You may need to manually trust the certificate" -ForegroundColor Yellow
}

# Update .env file with SSL paths
Write-Host "`n[WORK] Updating .env configuration..." -ForegroundColor Yellow

$envPath = Join-Path $projectRoot "config\.env"
$envBackupPath = Join-Path $projectRoot "config\.env.backup"

if (Test-Path $envPath) {
    # Create backup
    Copy-Item $envPath $envBackupPath -Force
    Write-Host "[OK] Created backup: $envBackupPath" -ForegroundColor Green
    
    # Read existing .env
    $envContent = Get-Content $envPath -Raw
    
    # Update or add SSL configuration
    $sslCertPath = $certPath -replace '\\', '/'
    $sslKeyPath = $keyPath -replace '\\', '/'
    
    if ($envContent -match 'USE_HTTPS=') {
        $envContent = $envContent -replace 'USE_HTTPS=.*', 'USE_HTTPS=true'
    } else {
        $envContent += "`nUSE_HTTPS=true"
    }
    
    if ($envContent -match 'SSL_CERT_PATH=') {
        $envContent = $envContent -replace 'SSL_CERT_PATH=.*', "SSL_CERT_PATH=$sslCertPath"
    } else {
        $envContent += "`nSSL_CERT_PATH=$sslCertPath"
    }
    
    if ($envContent -match 'SSL_KEY_PATH=') {
        $envContent = $envContent -replace 'SSL_KEY_PATH=.*', "SSL_KEY_PATH=$sslKeyPath"
    } else {
        $envContent += "`nSSL_KEY_PATH=$sslKeyPath"
    }
    
    $envContent | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline
    Write-Host "[OK] Updated .env with SSL paths" -ForegroundColor Green
} else {
    Write-Host "[WARN] .env file not found, skipping configuration update" -ForegroundColor Yellow
}

# Copy files to WSL2 if WSL2 path exists
$wslPath = "/srv/app-socket-io/config/ssl"
Write-Host "`n[WORK] Checking for WSL2 installation..." -ForegroundColor Yellow

try {
    $wslCheck = wsl -l -q 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] WSL2 detected" -ForegroundColor Green
        Write-Host "[WORK] Copying certificates to WSL2..." -ForegroundColor Yellow
        
        # Create directory in WSL2
        wsl -e mkdir -p $wslPath 2>$null
        
        # Copy files
        $windowsCertPath = $certPath -replace '\\', '/'
        $windowsKeyPath = $keyPath -replace '\\', '/'
        $wslCertPath = "$wslPath/certificate.crt"
        $wslKeyPath = "$wslPath/private.key"
        
        # Convert Windows path to WSL path
        $driveLetter = $windowsCertPath.Substring(0,1).ToLower()
        $wslSourceCert = "/mnt/$driveLetter" + $windowsCertPath.Substring(2)
        $wslSourceKey = "/mnt/$driveLetter" + $windowsKeyPath.Substring(2)
        
        wsl -e cp $wslSourceCert $wslCertPath
        wsl -e cp $wslSourceKey $wslKeyPath
        wsl -e chmod 600 $wslKeyPath
        wsl -e chmod 644 $wslCertPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Certificates copied to WSL2: $wslPath" -ForegroundColor Green
            
            # Update WSL .env if it exists
            $wslEnvPath = "/srv/app-socket-io/config/.env"
            $wslCheckEnv = wsl -e test -f $wslEnvPath
            if ($LASTEXITCODE -eq 0) {
                wsl -e bash -c "sed -i 's|USE_HTTPS=.*|USE_HTTPS=true|' $wslEnvPath"
                wsl -e bash -c "sed -i 's|SSL_CERT_PATH=.*|SSL_CERT_PATH=$wslCertPath|' $wslEnvPath"
                wsl -e bash -c "sed -i 's|SSL_KEY_PATH=.*|SSL_KEY_PATH=$wslKeyPath|' $wslEnvPath"
                Write-Host "[OK] Updated WSL2 .env configuration" -ForegroundColor Green
            }
        } else {
            Write-Host "[WARN] Failed to copy to WSL2" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "[INFO] WSL2 not available or not configured" -ForegroundColor Gray
}

# Display summary
Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
Write-Host "[SUCCESS] SSL Certificate Setup Complete!" -ForegroundColor Green
Write-Host ("=" * 70) -ForegroundColor Cyan

Write-Host "`n[FILES] Generated Files:" -ForegroundColor Yellow
Write-Host "   Certificate: $certPath"
Write-Host "   Private Key: $keyPath"
Write-Host "   PFX Bundle:  $pfxPath"

Write-Host "`n[SCRIPT] Script Directory Copy (for manual operations):" -ForegroundColor Yellow
Write-Host "   Location: $scriptOutputPath"
Write-Host "   Certificate: $(Join-Path $scriptOutputPath 'certificate.crt')"
Write-Host "   Private Key: $(Join-Path $scriptOutputPath 'private.key')"
Write-Host "   PFX Bundle:  $(Join-Path $scriptOutputPath 'certificate.pfx')"
Write-Host "   PFX Password: $(Join-Path $scriptOutputPath 'pfx-password.txt')"

Write-Host "`n[CERT] Certificate Details:" -ForegroundColor Yellow
Write-Host "   Subject: $($cert.Subject)"
Write-Host "   Thumbprint: $($cert.Thumbprint)"
Write-Host "   Valid From: $($cert.NotBefore.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "   Valid Until: $($cert.NotAfter.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "   DNS Names: $($cert.DnsNameList.Unicode -join ', ')"

Write-Host "`n[INSTALLED] Certificate Installed In:" -ForegroundColor Yellow
Write-Host "   Personal: Cert:\CurrentUser\My\$($cert.Thumbprint)"
Write-Host "   Trusted Root: Cert:\CurrentUser\Root\$($cert.Thumbprint)"

Write-Host "`n[CONFIG] Configuration:" -ForegroundColor Yellow
Write-Host "   USE_HTTPS=true"
Write-Host "   SSL_CERT_PATH=$certPath"
Write-Host "   SSL_KEY_PATH=$keyPath"

Write-Host "`n[NEXT] Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Restart your Socket.IO server"
Write-Host "   2. Access via: https://localhost:3001"
Write-Host "   3. Browser will trust the certificate automatically"

if (Test-Path $pfxPath) {
    Write-Host "`n[MANUAL] To manually install certificate in Windows:" -ForegroundColor Gray
    Write-Host "   - Double-click: $(Join-Path $scriptOutputPath 'certificate.pfx')" -ForegroundColor Gray
    Write-Host "   - Password saved in: $(Join-Path $scriptOutputPath 'pfx-password.txt')" -ForegroundColor Gray
}

Write-Host ""
