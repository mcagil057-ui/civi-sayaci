# -*- coding: utf-8 -*-
"""Uçtan uca akış: ses dosyası + referans metin -> rapor.

PROJE.md'deki dört adım burada birleşir:
  1. girdi          ses dosyası + referans metin
  2. ses -> metin   ai_client üzerinden (yerel ya da uzak, ayar belirler)
  3. karşılaştırma  noktalama ve büyük/küçük harf farkı yok sayılarak
  4. çıktı          yüzde + eksik/fazla/yanlış + değerlendirme cümlesi

Buradaki hiçbir satır model adı, adres ya da port bilmez; hepsi ai_client'ın
ve ayarlar.toml'un işidir.
"""
import time

import ai_client
from ai_client.ses import SesHatasi

from . import degerlendir as dgr
from .karsilastir import karsilastir


def calistir(ses_yolu, referans_metin, dil=None, ayar=None,
             degerlendirme=True):
    """Boru hattını çalıştırır ve rapor sözlüğü döndürür.

    `dil` verilmezse ayardaki dil, o da boşsa modelin sezdiği dil kullanılır.
    Sezilen dil karşılaştırmayı da yönlendirir: Türkçe ve Arapça
    normalizasyon kuralları ayrıdır.
    """
    ayar = ayar or ai_client.Ayar.yukle()
    rapor = {"ses_yolu": ses_yolu, "sureler": {}}

    # --- 2. adım: ses -> metin -------------------------------------------
    t = time.time()
    cozum = ai_client.ses_istemcisi(ayar).cevir(ses_yolu, dil=dil)
    rapor["sureler"]["ses_metin"] = round(time.time() - t, 2)
    rapor["cozum"] = cozum.sozluk()

    # Karşılaştırma dili: elle verilen > ayardaki > modelin sezdiği.
    kullanilan_dil = dil or (ayar.ses.dil or None) or cozum.dil or "tr"
    rapor["dil"] = kullanilan_dil

    # --- 3. adım: karşılaştırma ------------------------------------------
    t = time.time()
    sonuc = karsilastir(referans_metin, cozum.metin, kullanilan_dil)
    rapor["sureler"]["karsilastirma"] = round(time.time() - t, 2)
    rapor.update(sonuc.sozluk())

    # --- 4. adım: değerlendirme cümlesi ----------------------------------
    if degerlendirme:
        t = time.time()
        istemci = ai_client.metin_istemcisi(ayar)
        cumle, kaynak = dgr.degerlendir(sonuc, istemci)
        rapor["sureler"]["degerlendirme"] = round(time.time() - t, 2)
    else:
        cumle, kaynak = dgr.sablon_cumle(sonuc), "sablon"
    rapor["degerlendirme"] = cumle
    rapor["degerlendirme_kaynagi"] = kaynak

    rapor["sureler"]["toplam"] = round(sum(rapor["sureler"].values()), 2)
    return rapor


def metinden(soylenen_metin, referans_metin, dil="tr", ayar=None,
             degerlendirme=True):
    """Ses adımını atlar; elde hazır metin varken (ya da test ederken)."""
    ayar = ayar or ai_client.Ayar.yukle()
    sonuc = karsilastir(referans_metin, soylenen_metin, dil)
    rapor = {"dil": dil, "cozum": {"metin": soylenen_metin, "dil": dil}}
    rapor.update(sonuc.sozluk())
    istemci = ai_client.metin_istemcisi(ayar) if degerlendirme else None
    cumle, kaynak = dgr.degerlendir(sonuc, istemci)
    rapor["degerlendirme"] = cumle
    rapor["degerlendirme_kaynagi"] = kaynak
    return rapor


__all__ = ["calistir", "metinden", "SesHatasi"]
