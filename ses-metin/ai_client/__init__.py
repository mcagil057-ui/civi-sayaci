# -*- coding: utf-8 -*-
"""ai_client — model çağrılarının tek geçiş noktası.

Bu paket uygulamadan bağımsızdır: ses-metin dışındaki başka uygulamalar da
aynı katmanı olduğu gibi kullanabilsin diye hiçbir yerde karşılaştırma,
raporlama ya da uygulamaya özgü mantık geçmez. Burada yalnız şu vardır:
ayarı oku, doğru istemciyi kur, çağrıyı yap.

Kullanım:
    from ai_client import Ayar, ses_istemcisi, metin_istemcisi
    ayar = Ayar.yukle()
    cozum = ses_istemcisi(ayar).cevir("kayit.m4a", dil="tr")
    cumle = metin_istemcisi(ayar).uret("...")
"""
from .ayar import Ayar
from .ses import (Cozum, DosyaSes, SesHatasi, SesIstemcisi, UzakSes,
                  YerelSes)
from .metin import MetinHatasi, MetinIstemcisi, OllamaMetin, SablonMetin

__all__ = ["Ayar", "Cozum", "SesHatasi", "SesIstemcisi", "YerelSes", "UzakSes",
           "DosyaSes",
           "MetinHatasi", "MetinIstemcisi", "OllamaMetin", "SablonMetin",
           "ses_istemcisi", "metin_istemcisi"]


def ses_istemcisi(ayar=None):
    """Ayardaki `[ses].saglayici` değerine göre doğru istemciyi kurar."""
    ayar = ayar or Ayar.yukle()
    a = ayar.ses
    saglayici = (a.saglayici or "yerel").lower()
    if saglayici in ("uzak", "http", "sunucu"):
        return UzakSes(a.adres, model=a.model, dil=a.dil)
    if saglayici in ("dosya", "test"):
        return DosyaSes()
    if saglayici in ("yerel", "local", "faster-whisper"):
        return YerelSes(model=a.model, hesap_tipi=a.hesap_tipi,
                        is_parcacigi=a.is_parcacigi, dil=a.dil,
                        model_dizini=a.model_dizini)
    raise ValueError("Bilinmeyen ses sağlayıcısı: %r "
                     "(beklenen: yerel / uzak / dosya)" % a.saglayici)


def metin_istemcisi(ayar=None):
    """Ayardaki `[metin].saglayici` değerine göre doğru istemciyi kurar."""
    ayar = ayar or Ayar.yukle()
    a = ayar.metin
    saglayici = (a.saglayici or "ollama").lower()
    if saglayici in ("sablon", "yok", "kapali"):
        return SablonMetin()
    if saglayici == "ollama":
        return OllamaMetin(a.adres, a.model, bellekte_tut=a.bellekte_tut,
                           zaman_asimi=a.zaman_asimi, sicaklik=a.sicaklik,
                           azami_belirtec=a.azami_belirtec)
    raise ValueError("Bilinmeyen metin sağlayıcısı: %r "
                     "(beklenen: ollama / sablon)" % a.saglayici)
