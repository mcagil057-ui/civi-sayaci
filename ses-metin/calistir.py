#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ses–metin uyuşma kontrolü — komut satırı.

Örnekler:
  python3 calistir.py --ses kayit.m4a --metin referans.txt
  python3 calistir.py --ses kayit.m4a --metin-satiri "bugün hava çok güzel"
  python3 calistir.py --soylenen "bugün hava güzel" --metin-satiri "bugün hava çok güzel"
  python3 calistir.py --ses kayit.m4a --metin referans.txt --json > sonuc.json

Ses hiç verilmezse (--soylenen ile) model gerekmez; karşılaştırma saf
Python'dur, her makinede çalışır.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ai_client
from ai_client.ses import SesHatasi
from sesmetin import akis

ISARET = {"dogru": " ", "yakin": "~", "yanlis": "!", "eksik": "-",
          "fazla": "+"}


def _metni_oku(yol):
    with open(yol, encoding="utf-8") as f:
        return f.read()


def _hizalamayi_yaz(hizalama, sinir=400):
    """Referans metni işaretleyerek basar: nerede ne olduğu görünsün."""
    print("\nOkuma dökümü   ( ~yakın  !yanlış  -atlanan  +fazladan )")
    print("-" * 62)
    satir, uzunluk = [], 0
    for adim in hizalama[:sinir]:
        tur = adim["tur"]
        kelime = adim.get("beklenen") or adim.get("soylenen") or ""
        if tur == "dogru":
            parca = kelime
        elif tur == "yakin":
            parca = "~%s" % kelime
        elif tur == "yanlis":
            parca = "!%s→%s" % (adim["beklenen"], adim["soylenen"])
        elif tur == "eksik":
            parca = "-%s" % kelime
        else:
            parca = "+%s" % kelime
        if uzunluk + len(parca) > 60:
            print("  " + " ".join(satir))
            satir, uzunluk = [], 0
        satir.append(parca)
        uzunluk += len(parca) + 1
    if satir:
        print("  " + " ".join(satir))
    if len(hizalama) > sinir:
        print("  ... (%d kelime daha)" % (len(hizalama) - sinir))


def _raporu_yaz(rapor):
    print("=" * 62)
    print("  UYUŞMA:  %%%.1f" % rapor["uyusma"])
    print("=" * 62)
    print("  dil                : %s" % rapor.get("dil"))
    print("  referans kelime    : %d" % rapor["referans_sayisi"])
    print("  söylenen kelime    : %d" % rapor["soylenen_sayisi"])
    print("  doğru              : %d" % rapor["dogru_sayisi"])
    if rapor["yakin"]:
        print("  yakın (doğru sayıldı): %d" % len(rapor["yakin"]))
    print("  yanlış             : %d" % len(rapor["yanlis"]))
    print("  atlanan            : %d" % len(rapor["eksik"]))
    print("  fazladan           : %d" % len(rapor["fazla"]))

    if rapor["eksik"]:
        print("\n  Atlanan kelimeler : %s" % ", ".join(rapor["eksik"][:20]))
    if rapor["yanlis"]:
        ciftler = ["%s → %s" % (a["beklenen"], a["soylenen"])
                   for a in rapor["yanlis"][:20]]
        print("  Yanlış okunanlar  : %s" % ", ".join(ciftler))
    if rapor["fazla"]:
        print("  Fazladan söylenen : %s" % ", ".join(rapor["fazla"][:20]))
    if rapor["yakin"]:
        ciftler = ["%s ≈ %s" % (a["beklenen"], a["soylenen"])
                   for a in rapor["yakin"][:20]]
        print("  Yakın eşleşenler  : %s" % ", ".join(ciftler))

    _hizalamayi_yaz(rapor["hizalama"])

    kaynak = rapor.get("degerlendirme_kaynagi")
    etiket = "yerel model" if kaynak == "model" else "şablon (model yok)"
    print("\n" + "-" * 62)
    print("  Değerlendirme (%s):" % etiket)
    print("  %s" % rapor["degerlendirme"])
    print("-" * 62)

    sureler = rapor.get("sureler")
    if sureler:
        print("  Süreler: " + ", ".join("%s %.2fs" % (k, v)
                                        for k, v in sureler.items()))


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Ses kaydını referans metinle karşılaştırır.")
    ap.add_argument("--ses", help="ses dosyası (mp3, wav, m4a, ogg ...)")
    ap.add_argument("--soylenen",
                    help="ses yerine doğrudan söylenen metin (model gerekmez)")
    ap.add_argument("--metin", help="referans metin dosyası")
    ap.add_argument("--metin-satiri", help="referans metni doğrudan")
    ap.add_argument("--dil", help="tr / ar — boşsa ayardaki, o da boşsa sezilen")
    ap.add_argument("--ayar", help="ayarlar.toml yolu")
    ap.add_argument("--json", action="store_true", help="çıktıyı JSON ver")
    ap.add_argument("--degerlendirme-yok", action="store_true",
                    help="yerel LLM'i hiç çağırma, şablon cümle kullan")
    a = ap.parse_args(argv)

    if not a.metin and not a.metin_satiri:
        ap.error("referans metin gerekli: --metin ya da --metin-satiri")
    if not a.ses and not a.soylenen:
        ap.error("girdi gerekli: --ses ya da --soylenen")

    referans = a.metin_satiri if a.metin_satiri else _metni_oku(a.metin)
    ayar = ai_client.Ayar.yukle(a.ayar)

    try:
        if a.soylenen:
            rapor = akis.metinden(a.soylenen, referans, dil=a.dil or "tr",
                                  ayar=ayar,
                                  degerlendirme=not a.degerlendirme_yok)
        else:
            rapor = akis.calistir(a.ses, referans, dil=a.dil, ayar=ayar,
                                  degerlendirme=not a.degerlendirme_yok)
    except SesHatasi as e:
        print("Ses çevrilemedi: %s" % e, file=sys.stderr)
        return 2

    if a.json:
        print(json.dumps(rapor, ensure_ascii=False, indent=2))
    else:
        if rapor.get("cozum", {}).get("metin"):
            print("\nÇözülen metin:\n  %s\n" % rapor["cozum"]["metin"].strip())
        _raporu_yaz(rapor)
    return 0


if __name__ == "__main__":
    sys.exit(main())
