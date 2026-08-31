#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bu makinede her adımın ne kadar sürdüğünü ölçer.

Yaşlı bir makinede asıl soru "çalışıyor mu" değil, "beklenebilir mi".
Bu betik gerçek sayıları verir: model yükleme, ses çevirme (gerçek zaman
katsayısıyla), karşılaştırma ve değerlendirme süreleri; ayrıca tepe bellek
kullanımı.

    python3 olcum.py                        # örnek sesle
    python3 olcum.py --ses kendi-kaydim.m4a --metin kendi-metnim.txt
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ai_client
from ai_client.ses import SesHatasi
from sesmetin.karsilastir import karsilastir


def _bellek_mb():
    """Bu sürecin tepe bellek kullanımı (MB). Ölçülemezse None."""
    try:
        import resource
        tepe = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux kB, macOS bayt döndürür.
        return tepe / 1024 if sys.platform != "darwin" else tepe / 1048576
    except Exception:
        return None


def _ses_suresi(yol):
    """Ses uzunluğu (saniye). ffprobe varsa ondan, yoksa wave modülünden."""
    import subprocess
    try:
        cikti = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", yol],
            capture_output=True, text=True, timeout=20).stdout.strip()
        if cikti:
            return float(cikti)
    except Exception:
        pass
    try:
        import wave
        with wave.open(yol) as w:
            return w.getnframes() / float(w.getframerate())
    except Exception:
        return None


def main(argv=None):
    kok = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="Başarım ölçümü")
    ap.add_argument("--ses", default=os.path.join(kok, "ornek", "ornek-tr.wav"))
    ap.add_argument("--metin", default=os.path.join(kok, "ornek",
                                                    "ornek-tr.txt"))
    ap.add_argument("--dil", default="tr")
    ap.add_argument("--ayar")
    a = ap.parse_args(argv)

    ayar = ai_client.Ayar.yukle(a.ayar)
    print("\nBaşarım ölçümü")
    print("=" * 58)
    print("  cpu çekirdek : %s" % (os.cpu_count() or "?"))
    print("  whisper      : %s (%s)" % (ayar.ses.model, ayar.ses.hesap_tipi))
    print("  llm          : %s / %s" % (ayar.metin.saglayici,
                                        ayar.metin.model))
    if not os.path.exists(a.ses):
        print("\n  Ses dosyası yok: %s" % a.ses)
        return 1
    sure = _ses_suresi(a.ses)
    print("  ses          : %s%s" % (os.path.basename(a.ses),
                                     " (%.1f sn)" % sure if sure else ""))
    print("-" * 58)

    with open(a.metin, encoding="utf-8") as f:
        referans = f.read()

    # --- model yükleme ---------------------------------------------------
    istemci = ai_client.ses_istemcisi(ayar)
    t = time.time()
    try:
        hazir = istemci.hazir_mi()
    except Exception as e:
        print("  model yüklenemedi: %s" % e)
        return 1
    yukleme = time.time() - t
    if not hazir:
        print("  model yüklenemedi. Önce kurulum.sh çalıştır.")
        return 1
    print("  model yükleme      : %6.2f sn  (yalnızca ilk seferde)" % yukleme)

    # --- ses -> metin ----------------------------------------------------
    t = time.time()
    try:
        cozum = istemci.cevir(a.ses, dil=a.dil)
    except SesHatasi as e:
        print("  ses çevrilemedi: %s" % e)
        return 1
    cevirme = time.time() - t
    katsayi = (sure / cevirme) if (sure and cevirme > 0) else None
    print("  ses -> metin       : %6.2f sn%s" % (
        cevirme, "  (%.1fx gerçek zaman)" % katsayi if katsayi else ""))
    print("       çözülen: %s" % (cozum.metin[:60] or "(boş)"))

    # --- karşılaştırma ---------------------------------------------------
    t = time.time()
    sonuc = karsilastir(referans, cozum.metin, a.dil)
    kars = time.time() - t
    print("  karşılaştırma      : %6.3f sn  (%d kelime)"
          % (kars, sonuc.referans_sayisi))

    # --- değerlendirme ---------------------------------------------------
    from sesmetin.degerlendir import degerlendir
    t = time.time()
    cumle, kaynak = degerlendir(sonuc, ai_client.metin_istemcisi(ayar))
    dgr = time.time() - t
    print("  değerlendirme      : %6.2f sn  (%s)" % (dgr, kaynak))

    print("-" * 58)
    print("  TOPLAM (model yüklü): %.2f sn" % (cevirme + kars + dgr))
    bellek = _bellek_mb()
    if bellek:
        print("  tepe bellek         : %.0f MB" % bellek)
    print("\n  uyuşma %.1f%% — %s" % (sonuc.uyusma, cumle))

    if katsayi and katsayi < 1:
        print("\n  Not: çevirme gerçek zamandan yavaş. Daha küçük bir model")
        print("  (ayarlar.toml -> [ses].model = \"base\") işi hızlandırır.")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
