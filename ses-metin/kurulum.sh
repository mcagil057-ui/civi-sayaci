#!/usr/bin/env bash
# Ses–Metin Uyuşma Kontrolü — Linux / macOS kurulumu
#
# Hiçbir ücretli servis kullanılmaz, hiçbir API anahtarı istenmez.
# İndirilen her şey açık kaynaktır ve bu makinede kalır.
#
# Büyük indirmelerden önce boyut söylenir ve onay istenir.
# Onaysız geçmek için:  ./kurulum.sh --onayla
set -u
cd "$(dirname "$0")"
KOK="$(pwd)"

OTOMATIK=0
[ "${1:-}" = "--onayla" ] && OTOMATIK=1

kirmizi() { printf "\033[31m%s\033[0m\n" "$*"; }
yesil()   { printf "\033[32m%s\033[0m\n" "$*"; }
sari()    { printf "\033[33m%s\033[0m\n" "$*"; }
baslik()  { echo; printf "\033[1m== %s ==\033[0m\n" "$*"; }

sor() {
  # sor "<açıklama>" "<boyut>"  -> onay alınırsa 0 döner
  [ "$OTOMATIK" = "1" ] && return 0
  echo
  sari "  İNDİRİLECEK: $1"
  sari "  BOYUT      : $2"
  printf "  Devam edilsin mi? [e/H] "
  read -r yanit </dev/tty || return 1
  case "$yanit" in [eE]|[eE][vV][eE][tT]) return 0 ;; *) return 1 ;; esac
}

# ---------------------------------------------------------------- donanım
baslik "1/6  Donanım"
ISLETIM="$(uname -s)"
echo "  işletim sistemi : $ISLETIM $(uname -r)"
if [ "$ISLETIM" = "Darwin" ]; then
  CEKIRDEK=$(sysctl -n hw.ncpu 2>/dev/null || echo "?")
  RAM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
  echo "  işlemci         : $(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
else
  CEKIRDEK=$(nproc 2>/dev/null || echo "?")
  RAM_GB=$(( $(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0) / 1048576 ))
  echo "  işlemci         : $(awk -F: '/model name/{print $2; exit}' /proc/cpuinfo 2>/dev/null | sed 's/^ //')"
fi
DISK_GB=$(df -Pk . | awk 'NR==2{printf "%d", $4/1048576}')
echo "  çekirdek        : $CEKIRDEK"
echo "  RAM             : ${RAM_GB} GB"
echo "  boş disk        : ${DISK_GB} GB"
if command -v nvidia-smi >/dev/null 2>&1; then
  echo "  GPU             : $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)"
else
  echo "  GPU             : yok (CPU kullanılacak)"
fi

# RAM'e göre öneri
if   [ "$RAM_GB" -ge 8 ]; then WHISPER=small; LLM="qwen2.5:3b-instruct-q4_K_M"; LLM_BOYUT="~1.9 GB"
elif [ "$RAM_GB" -ge 4 ]; then WHISPER=base;  LLM="qwen2.5:1.5b-instruct-q4_K_M"; LLM_BOYUT="~1.0 GB"
else                           WHISPER=tiny;  LLM="qwen2.5:1.5b-instruct-q4_K_M"; LLM_BOYUT="~1.0 GB"
fi
case "$WHISPER" in
  small) W_BOYUT="~0.5 GB" ;; base) W_BOYUT="~0.15 GB" ;; *) W_BOYUT="~0.08 GB" ;;
esac
echo
yesil "  Bu donanım için öneri: Whisper '$WHISPER', LLM '$LLM'"
echo "  (ayarlar.toml'dan sonradan değiştirebilirsin)"

if [ "$DISK_GB" -lt 8 ]; then
  kirmizi "  UYARI: boş disk 8 GB'ın altında. Kurulum sıkışabilir."
fi

# ---------------------------------------------------------------- python
baslik "2/6  Python"
command -v python3 >/dev/null 2>&1 || { kirmizi "  python3 bulunamadı. Önce Python 3.9+ kur."; exit 1; }
PY_SURUM=$(python3 -c 'import sys;print("%d.%d"%sys.version_info[:2])')
echo "  python3 $PY_SURUM"
python3 -c 'import sys;sys.exit(0 if sys.version_info>=(3,9) else 1)' || {
  kirmizi "  Python 3.9 veya üstü gerekli."; exit 1; }

if [ ! -d "$KOK/.venv" ]; then
  echo "  sanal ortam kuruluyor (.venv) — sistem Python'unu kirletmemek için"
  python3 -m venv "$KOK/.venv" || { kirmizi "  venv kurulamadı"; exit 1; }
fi
PY="$KOK/.venv/bin/python"
echo "  sanal ortam: $KOK/.venv"

# ---------------------------------------------------------------- ffmpeg
baslik "3/6  ffmpeg"
if command -v ffmpeg >/dev/null 2>&1; then
  yesil "  zaten kurulu: $(ffmpeg -version | head -1 | cut -c1-45)"
else
  echo "  ffmpeg yok. Ses dosyalarını okumak için gerekli (~100 MB)."
  if   command -v apt-get >/dev/null 2>&1; then KOMUT="sudo apt-get install -y ffmpeg"
  elif command -v dnf     >/dev/null 2>&1; then KOMUT="sudo dnf install -y ffmpeg"
  elif command -v pacman  >/dev/null 2>&1; then KOMUT="sudo pacman -S --noconfirm ffmpeg"
  elif command -v brew    >/dev/null 2>&1; then KOMUT="brew install ffmpeg"
  else KOMUT=""; fi
  if [ -n "$KOMUT" ] && sor "ffmpeg (ses dosyası okuyucu)" "~100 MB"; then
    echo "  çalıştırılıyor: $KOMUT"
    $KOMUT || kirmizi "  ffmpeg kurulamadı — elle kurman gerekebilir."
  else
    sari "  atlandı. ffmpeg olmadan yalnızca .wav dosyaları okunabilir."
  fi
fi

# ------------------------------------------------------------ faster-whisper
baslik "4/6  faster-whisper"
if "$PY" -c "import faster_whisper" 2>/dev/null; then
  yesil "  zaten kurulu"
else
  if sor "faster-whisper ve bağımlılıkları (ctranslate2, tokenizers, onnxruntime)" "~500 MB"; then
    "$PY" -m pip install --quiet --upgrade pip
    "$PY" -m pip install --quiet faster-whisper && yesil "  kuruldu" \
      || { kirmizi "  kurulamadı"; exit 1; }
  else
    sari "  atlandı. Ses çevirisi çalışmaz; --soylenen ile metin karşılaştırması yine çalışır."
  fi
fi

# ---------------------------------------------------------------- ollama
baslik "5/6  Ollama + yerel model"
if command -v ollama >/dev/null 2>&1; then
  yesil "  ollama zaten kurulu: $(ollama --version 2>&1 | head -1)"
else
  if sor "Ollama (yerel model çalıştırıcı)" "~1.5 GB"; then
    if [ "$ISLETIM" = "Darwin" ]; then
      if command -v brew >/dev/null 2>&1; then brew install ollama
      else sari "  macOS: https://ollama.com/download adresinden indir, sonra bu betiği tekrar çalıştır."; fi
    else
      curl -fsSL https://ollama.com/install.sh | sh \
        || kirmizi "  Ollama kurulamadı — https://ollama.com/download"
    fi
  else
    sari "  atlandı. Değerlendirme cümlesi şablondan üretilecek (uygulama yine çalışır)."
  fi
fi

if command -v ollama >/dev/null 2>&1; then
  # Servis ayakta değilse arka planda başlat
  if ! curl -s --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    echo "  ollama servisi başlatılıyor"
    (ollama serve >/dev/null 2>&1 &)
    sleep 4
  fi
  if ollama list 2>/dev/null | grep -q "${LLM%%:*}"; then
    yesil "  model zaten inmiş: $LLM"
  elif sor "yerel dil modeli $LLM" "$LLM_BOYUT"; then
    ollama pull "$LLM" && yesil "  model indi" || kirmizi "  model inmedi"
  else
    sari "  atlandı — ayarlar.toml'da saglayici = \"sablon\" yap."
  fi
fi

# ------------------------------------------------------- whisper modelini indir
baslik "6/6  Whisper modeli"
if "$PY" -c "import faster_whisper" 2>/dev/null; then
  if sor "Whisper '$WHISPER' modeli (ilk kullanımda zaten inecekti)" "$W_BOYUT"; then
    "$PY" - <<PYEOF
from faster_whisper import WhisperModel
print("  indiriliyor / yükleniyor: $WHISPER")
WhisperModel("$WHISPER", device="cpu", compute_type="int8")
print("  hazır")
PYEOF
  else
    sari "  atlandı — ilk çalıştırmada kendiliğinden inecek."
  fi
fi

# ------------------------------------------------------------- ayarı güncelle
if [ -f "$KOK/ayarlar.toml" ]; then
  # Donanıma göre seçilen modelleri ayara yaz (yalnızca ilk kurulumda).
  "$PY" - <<PYEOF
import re
yol = "$KOK/ayarlar.toml"
with open(yol, encoding="utf-8") as f:
    m = f.read()
m = re.sub(r'(?m)^(model = )"small"$', r'\1"$WHISPER"', m, count=1)
m = re.sub(r'(?m)^(model = )"qwen2\.5:3b-instruct-q4_K_M"$', r'\1"$LLM"', m, count=1)
with open(yol, "w", encoding="utf-8") as f:
    f.write(m)
print("  ayarlar.toml güncellendi: whisper=$WHISPER, llm=$LLM")
PYEOF
fi

baslik "Kurulum bitti — doğrulama"
"$PY" "$KOK/dogrula.py" || true

echo
yesil "Deneme komutu:"
echo "  $PY calistir.py --ses ornek/ornek-tr.wav --metin ornek/ornek-tr.txt"
echo
echo "Testler (model gerekmez):"
echo "  ./test-et.sh"
