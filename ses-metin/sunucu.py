#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ses → metin servisini HTTP'den açar.

Bunun varlık sebebi mimaridir: modüller başka makineye taşınabilmeli ve
taşınırken yalnızca adres değişmeli. Whisper'ı güçlü bir makinede
çalıştırmak isteyen kişi oraya bu dosyayı koyar:

    python3 sunucu.py --port 8020

sonra zayıf makinedeki ayarlar.toml'da yalnızca şunu değiştirir:

    [ses]
    saglayici = "uzak"
    adres     = "http://192.168.1.20:8020"

Uygulama kodunda tek satır değişmez.

Uçlar:
    GET  /saglik   -> {"durum": "hazir", "model": "small"}
    POST /cevir    -> multipart: ses=<dosya>, dil=<tr|ar|"">
                      {"metin": ..., "dil": ..., "sure": ..., "parcalar": [...]}

Not: kimlik doğrulama yoktur. Yalnızca güvendiğiniz yerel ağda çalıştırın;
açık internete koymayın.
"""
import argparse
import json
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ai_client
from ai_client.ses import DosyaSes, SesHatasi, YerelSes

ISTEMCI = None
AYAR = None


def _coklu_parca_coz(icerik_turu, govde):
    """multipart/form-data gövdesini çözer.

    Standart kütüphanenin `cgi` modülü Python 3.13'te kaldırıldığı için elle
    çözüyoruz; ai_client/ses.py'deki kodlayıcının simetriği. Ses dosyası ikili
    veri olduğundan gövde baştan sona bayt olarak işlenir, hiçbir yerde
    metne çevrilmez.

    Döndürdüğü: {alan_adi: (dosya_adi | None, icerik_baytlari)}
    """
    if "boundary=" not in icerik_turu:
        raise ValueError("multipart sınırı yok")
    sinir = icerik_turu.split("boundary=", 1)[1].strip().strip('"')
    ayrac = ("--" + sinir).encode("utf-8")

    alanlar = {}
    for parca in govde.split(ayrac):
        if not parca or parca in (b"--\r\n", b"--", b"\r\n"):
            continue
        parca = parca.lstrip(b"\r\n")
        if b"\r\n\r\n" not in parca:
            continue
        basliklar, icerik = parca.split(b"\r\n\r\n", 1)
        if icerik.endswith(b"\r\n"):
            icerik = icerik[:-2]
        basliklar = basliklar.decode("utf-8", "replace")
        ad = dosya_adi = None
        for baslik in basliklar.split("\r\n"):
            if baslik.lower().startswith("content-disposition:"):
                for kisim in baslik.split(";")[1:]:
                    kisim = kisim.strip()
                    if kisim.startswith("name="):
                        ad = kisim[5:].strip('"')
                    elif kisim.startswith("filename="):
                        dosya_adi = kisim[9:].strip('"')
        if ad:
            alanlar[ad] = (dosya_adi, icerik)
    return alanlar


class Yonlendirici(BaseHTTPRequestHandler):
    # Varsayılan günlük her isteği stderr'e basar; sade tutuyoruz.
    def log_message(self, bicim, *args):
        sys.stderr.write("  %s\n" % (bicim % args))

    def _yanit(self, kod, govde):
        veri = json.dumps(govde, ensure_ascii=False).encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(veri)))
        self.end_headers()
        self.wfile.write(veri)

    def do_GET(self):
        if self.path.rstrip("/") in ("/saglik", "/health"):
            self._yanit(200, {"durum": "hazir", "model": AYAR.ses.model,
                              "hesap_tipi": AYAR.ses.hesap_tipi})
        else:
            self._yanit(404, {"hata": "bilinmeyen uç: %s" % self.path})

    def do_POST(self):
        if self.path.rstrip("/") != "/cevir":
            self._yanit(404, {"hata": "bilinmeyen uç: %s" % self.path})
            return
        try:
            uzunluk = int(self.headers.get("Content-Length") or 0)
            ham = self.rfile.read(uzunluk)
            alanlar = _coklu_parca_coz(self.headers.get("Content-Type", ""), ham)
        except Exception as e:
            self._yanit(400, {"hata": "istek okunamadı: %s" % e})
            return

        if "ses" not in alanlar:
            self._yanit(400, {"hata": "ses alanı yok"})
            return
        dosya_adi, icerik = alanlar["ses"]
        dil_alani = alanlar.get("dil")
        dil = None
        if dil_alani:
            dil = (dil_alani[1].decode("utf-8", "replace").strip() or None)

        # Whisper dosya yolu bekliyor; gelen içeriği geçici dosyaya yazıyoruz.
        uzanti = os.path.splitext(dosya_adi or "")[1] or ".wav"
        gecici = tempfile.NamedTemporaryFile(suffix=uzanti, delete=False)
        try:
            gecici.write(icerik)
            gecici.close()
            cozum = ISTEMCI.cevir(gecici.name, dil=dil)
            self._yanit(200, cozum.sozluk())
        except SesHatasi as e:
            self._yanit(500, {"hata": str(e)})
        except Exception as e:
            self._yanit(500, {"hata": "beklenmeyen hata: %s" % e})
        finally:
            try:
                os.unlink(gecici.name)
            except OSError:
                pass


def main(argv=None):
    global ISTEMCI, AYAR
    ap = argparse.ArgumentParser(description="Ses→metin HTTP servisi")
    ap.add_argument("--adres", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8020)
    ap.add_argument("--ayar", help="ayarlar.toml yolu")
    a = ap.parse_args(argv)

    AYAR = ai_client.Ayar.yukle(a.ayar)
    # Sunucu asla "uzak" olamaz — kendi kendine sorup sonsuz döngüye girerdi.
    # Ayarda "dosya" seçiliyse test kipinde çalışır, diğer her durumda yerel.
    if (AYAR.ses.saglayici or "").lower() in ("dosya", "test"):
        ISTEMCI = DosyaSes()
    else:
        ISTEMCI = YerelSes(model=AYAR.ses.model, hesap_tipi=AYAR.ses.hesap_tipi,
                           is_parcacigi=AYAR.ses.is_parcacigi,
                           dil=AYAR.ses.dil, model_dizini=AYAR.ses.model_dizini)

    print("Ses→metin servisi  http://%s:%d" % (a.adres, a.port))
    print("  model: %s (%s)" % (AYAR.ses.model, AYAR.ses.hesap_tipi))
    print("  model ilk istekte yüklenir; ilk çağrı yavaştır.")
    print("  Kapatmak için Ctrl+C")
    sunucu = ThreadingHTTPServer((a.adres, a.port), Yonlendirici)
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        print("\nkapatılıyor")
        sunucu.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
