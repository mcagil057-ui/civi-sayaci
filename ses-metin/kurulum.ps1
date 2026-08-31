# Ses-Metin Uyusma Kontrolu - Windows kurulumu
#
# Calistirma (PowerShell):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\kurulum.ps1
#
# Hicbir ucretli servis kullanilmaz, hicbir API anahtari istenmez.
# Buyuk indirmelerden once boyut soylenir ve onay istenir (-Onayla ile atlanir).

param([switch]$Onayla)

$ErrorActionPreference = "Continue"
$Kok = $PSScriptRoot
Set-Location $Kok

function Baslik($m) { Write-Host ""; Write-Host "== $m ==" -ForegroundColor White }
function Yesil($m)  { Write-Host $m -ForegroundColor Green }
function Sari($m)   { Write-Host $m -ForegroundColor Yellow }
function Kirmizi($m){ Write-Host $m -ForegroundColor Red }

function Sor($ne, $boyut) {
  if ($Onayla) { return $true }
  Write-Host ""
  Sari "  INDIRILECEK: $ne"
  Sari "  BOYUT      : $boyut"
  $y = Read-Host "  Devam edilsin mi? [e/H]"
  return ($y -eq "e" -or $y -eq "E" -or $y -eq "evet")
}

# ------------------------------------------------------------- donanim
Baslik "1/6  Donanim"
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$diskGB = [math]::Round((Get-PSDrive -Name ($Kok.Substring(0,1))).Free / 1GB)
Write-Host "  isletim sistemi : $((Get-CimInstance Win32_OperatingSystem).Caption)"
Write-Host "  islemci         : $($cpu.Name)"
Write-Host "  cekirdek        : $($cpu.NumberOfCores)"
Write-Host "  RAM             : $ramGB GB"
Write-Host "  bos disk        : $diskGB GB"
$gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name
Write-Host "  ekran karti     : $gpu"

if ($ramGB -ge 8)     { $Whisper="small"; $WBoyut="~0.5 GB";  $Llm="qwen2.5:3b-instruct-q4_K_M";   $LBoyut="~1.9 GB" }
elseif ($ramGB -ge 4) { $Whisper="base";  $WBoyut="~0.15 GB"; $Llm="qwen2.5:1.5b-instruct-q4_K_M"; $LBoyut="~1.0 GB" }
else                  { $Whisper="tiny";  $WBoyut="~0.08 GB"; $Llm="qwen2.5:1.5b-instruct-q4_K_M"; $LBoyut="~1.0 GB" }
Write-Host ""
Yesil "  Bu donanim icin oneri: Whisper '$Whisper', LLM '$Llm'"
if ($diskGB -lt 8) { Kirmizi "  UYARI: bos disk 8 GB'in altinda." }

# --------------------------------------------------------------- python
Baslik "2/6  Python"
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { Kirmizi "  Python bulunamadi. https://python.org adresinden 3.9+ kur."; exit 1 }
$surum = & $py.Source -c "import sys;print('%d.%d'%sys.version_info[:2])"
Write-Host "  python $surum"

if (-not (Test-Path "$Kok\.venv")) {
  Write-Host "  sanal ortam kuruluyor (.venv)"
  & $py.Source -m venv "$Kok\.venv"
}
$PY = "$Kok\.venv\Scripts\python.exe"
Write-Host "  sanal ortam: $Kok\.venv"

# --------------------------------------------------------------- ffmpeg
Baslik "3/6  ffmpeg"
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
  Yesil "  zaten kurulu"
} else {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    if (Sor "ffmpeg (ses dosyasi okuyucu)" "~100 MB") {
      winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    }
  } else {
    Sari "  ffmpeg yok ve winget bulunamadi."
    Sari "  https://www.gyan.dev/ffmpeg/builds/ adresinden indirip PATH'e ekle."
    Sari "  Olmadan yalnizca .wav dosyalari okunabilir."
  }
}

# --------------------------------------------------------- faster-whisper
Baslik "4/6  faster-whisper"
& $PY -c "import faster_whisper" 2>$null
if ($LASTEXITCODE -eq 0) {
  Yesil "  zaten kurulu"
} elseif (Sor "faster-whisper ve bagimliliklari" "~500 MB") {
  & $PY -m pip install --quiet --upgrade pip
  & $PY -m pip install --quiet faster-whisper
  if ($LASTEXITCODE -eq 0) { Yesil "  kuruldu" } else { Kirmizi "  kurulamadi" }
} else {
  Sari "  atlandi. --soylenen ile metin karsilastirmasi yine calisir."
}

# --------------------------------------------------------------- ollama
Baslik "5/6  Ollama + yerel model"
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  Yesil "  ollama zaten kurulu"
} elseif (Sor "Ollama (yerel model calistirici)" "~1.5 GB") {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
  } else {
    Sari "  https://ollama.com/download adresinden indir, sonra bu betigi tekrar calistir."
  }
} else {
  Sari "  atlandi. Degerlendirme cumlesi sablondan uretilecek."
}

if (Get-Command ollama -ErrorAction SilentlyContinue) {
  $inmis = (& ollama list 2>$null) -join "`n"
  if ($inmis -match [regex]::Escape($Llm.Split(':')[0])) {
    Yesil "  model zaten inmis: $Llm"
  } elseif (Sor "yerel dil modeli $Llm" $LBoyut) {
    & ollama pull $Llm
  } else {
    Sari "  atlandi - ayarlar.toml'da saglayici = `"sablon`" yap."
  }
}

# ------------------------------------------------------- whisper modeli
Baslik "6/6  Whisper modeli"
& $PY -c "import faster_whisper" 2>$null
if ($LASTEXITCODE -eq 0) {
  if (Sor "Whisper '$Whisper' modeli" $WBoyut) {
    & $PY -c "from faster_whisper import WhisperModel; WhisperModel('$Whisper', device='cpu', compute_type='int8'); print('  hazir')"
  } else {
    Sari "  atlandi - ilk calistirmada kendiliginden inecek."
  }
}

# ---------------------------------------------------------- ayari guncelle
if (Test-Path "$Kok\ayarlar.toml") {
  $m = Get-Content "$Kok\ayarlar.toml" -Raw -Encoding UTF8
  $m = $m -replace '(?m)^model = "small"$', "model = `"$Whisper`""
  $m = $m -replace '(?m)^model = "qwen2\.5:3b-instruct-q4_K_M"$', "model = `"$Llm`""
  Set-Content "$Kok\ayarlar.toml" -Value $m -Encoding UTF8 -NoNewline
  Write-Host "  ayarlar.toml guncellendi: whisper=$Whisper, llm=$Llm"
}

Baslik "Kurulum bitti - dogrulama"
& $PY "$Kok\dogrula.py"

Write-Host ""
Yesil "Deneme komutu:"
Write-Host "  $PY calistir.py --ses ornek\ornek-tr.wav --metin ornek\ornek-tr.txt"
Write-Host ""
Write-Host "Testler (model gerekmez):"
Write-Host "  $PY -m unittest discover -s testler -p `"test_*.py`""
