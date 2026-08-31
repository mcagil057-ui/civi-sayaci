#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kurulumun her parçasını tek tek sınar ve ne eksikse söyler.

Amaç: bir şey çalışmadığında hangi parçanın eksik olduğunu tahmin etmek
zorunda kalmamak. Hiçbir parça olmasa bile bu betik çalışır.
"""
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TAMAM, EKSIK, UYARI = "✓", "✗", "!"


def yaz(isaret, baslik, aciklama=""):
    print("  %s %-26s %s" % (isaret, baslik, aciklama))


def main():
    print("\nSes–Metin Uyuşma Kontrolü — kurulum doğrulaması")
    print("-" * 62)
    sorun = 0

    # --- ayar -------------------------------------------------------------
    try:
        import ai_client
        ayar = ai_client.Ayar.yukle()
        yaz(TAMAM, "ayar dosyası",
            "ses=%s/%s  metin=%s/%s" % (ayar.ses.saglayici, ayar.ses.model,
                                        ayar.metin.saglayici, ayar.metin.model))
    except Exception as e:
        yaz(EKSIK, "ayar dosyası", str(e))
        return 1

    # --- saf python kısmı (her zaman çalışmalı) ---------------------------
    try:
        from sesmetin.karsilastir import karsilastir
        s = karsilastir("bir iki üç", "bir iki", "tr")
        varsayim = len(s.eksik) == 1 and s.uyusma > 60
        yaz(TAMAM if varsayim else EKSIK, "karşılaştırma motoru",
            "uyuşma %.1f%%, eksik %d" % (s.uyusma, len(s.eksik)))
        sorun += 0 if varsayim else 1
    except Exception as e:
        yaz(EKSIK, "karşılaştırma motoru", str(e))
        sorun += 1

    # --- ffmpeg -----------------------------------------------------------
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        try:
            surum = subprocess.run([ffmpeg, "-version"], capture_output=True,
                                   text=True, timeout=10
                                   ).stdout.splitlines()[0][:40]
        except Exception:
            surum = ffmpeg
        yaz(TAMAM, "ffmpeg", surum)
    else:
        yaz(UYARI, "ffmpeg", "yok — yalnızca .wav okunabilir")

    # --- faster-whisper ---------------------------------------------------
    try:
        import faster_whisper
        yaz(TAMAM, "faster-whisper", "sürüm %s" % faster_whisper.__version__)
    except ImportError:
        yaz(EKSIK, "faster-whisper", "kurulu değil — kurulum.sh çalıştır")
        sorun += 1

    # --- whisper modeli inmiş mi -----------------------------------------
    try:
        import faster_whisper  # noqa: F811
        from ai_client.ses import YerelSes
        istemci = YerelSes(model=ayar.ses.model,
                           hesap_tipi=ayar.ses.hesap_tipi,
                           model_dizini=ayar.ses.model_dizini)
        if istemci.hazir_mi():
            yaz(TAMAM, "whisper modeli", "%s yüklenebiliyor" % ayar.ses.model)
        else:
            yaz(EKSIK, "whisper modeli",
                "%s yüklenemedi (indirilmemiş olabilir)" % ayar.ses.model)
            sorun += 1
    except ImportError:
        yaz(UYARI, "whisper modeli", "faster-whisper olmadan sınanamaz")
    except Exception as e:
        yaz(EKSIK, "whisper modeli", str(e)[:60])
        sorun += 1

    # --- ollama -----------------------------------------------------------
    try:
        istemci = ai_client.metin_istemcisi(ayar)
        tur = type(istemci).__name__
        if tur == "SablonMetin":
            yaz(UYARI, "yerel LLM",
                "ayarda 'sablon' seçili — cümleler şablondan gelecek")
        elif istemci.hazir_mi():
            yaz(TAMAM, "yerel LLM", "%s hazır (%s)"
                % (ayar.metin.model, ayar.metin.adres))
        else:
            yaz(UYARI, "yerel LLM",
                "%s erişilemedi — şablona düşülecek" % ayar.metin.adres)
    except Exception as e:
        yaz(UYARI, "yerel LLM", str(e)[:60])

    # --- örnek dosyalar ---------------------------------------------------
    kok = os.path.dirname(os.path.abspath(__file__))
    ses = os.path.join(kok, "ornek", "ornek-tr.wav")
    if os.path.exists(ses):
        yaz(TAMAM, "örnek ses", "%s (%.0f KB)"
            % (os.path.basename(ses), os.path.getsize(ses) / 1024))
    else:
        yaz(UYARI, "örnek ses", "yok")

    print("-" * 62)
    if sorun == 0:
        print("  Her şey yerinde.\n")
    else:
        print("  %d parça eksik. Yukarıdaki ✗ satırlarına bak.\n" % sorun)
    return 0 if sorun == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
