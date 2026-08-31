# -*- coding: utf-8 -*-
"""Ayar dosyasını okur.

Katmanın tek amacı: model adı, adres ve port kod içine hiç yazılmasın.
Uygulama `Ayar.yukle()` çağırır, ne okuduğuyla ilgilenmez.

Öncelik sırası:  ortam değişkeni  >  ayarlar.toml  >  koddaki varsayılan
Ortam değişkeni adı bölümden türetilir:  [ses].model  ->  SESMETIN_SES_MODEL
"""
import os

ONEK = "SESMETIN"

# Koddaki varsayılanlar. ayarlar.toml silinse bile katman çalışır.
VARSAYILAN = {
    "ses": {
        "saglayici": "yerel",
        "adres": "http://127.0.0.1:8020",
        "model": "small",
        "hesap_tipi": "int8",
        "is_parcacigi": 0,
        "dil": "",
        "model_dizini": "",
    },
    "metin": {
        "saglayici": "ollama",
        "adres": "http://127.0.0.1:11434",
        "model": "qwen2.5:3b-instruct-q4_K_M",
        "bellekte_tut": "0s",
        "zaman_asimi": 120,
        "sicaklik": 0.2,
        "azami_belirtec": 120,
    },
}


# --- TOML okuma ----------------------------------------------------------
# Python 3.11+ tomllib'i getirir. Daha eski bir yorumlayıcıda paket kurmak
# yerine küçük bir alt küme ayrıştırıcısı kullanıyoruz: ayar dosyamız
# yalnızca [bölüm] başlıkları ve "anahtar = değer" satırlarından oluşuyor.
def _toml_oku(metin):
    try:
        import tomllib
        return tomllib.loads(metin)
    except ImportError:
        pass
    try:
        import tomli
        return tomli.loads(metin)
    except ImportError:
        pass
    return _basit_toml(metin)


def _basit_toml(metin):
    """Yalnızca bölüm başlığı, dize, sayı ve mantıksal değeri anlar."""
    sonuc, bolum = {}, None
    for ham in metin.splitlines():
        satir = ham.split("#", 1)[0].strip()
        if not satir:
            continue
        if satir.startswith("[") and satir.endswith("]"):
            bolum = satir[1:-1].strip()
            sonuc.setdefault(bolum, {})
            continue
        if "=" not in satir or bolum is None:
            continue
        anahtar, _, deger = satir.partition("=")
        sonuc[bolum][anahtar.strip()] = _deger_coz(deger.strip())
    return sonuc


def _deger_coz(ham):
    if len(ham) >= 2 and ham[0] == ham[-1] and ham[0] in "\"'":
        return ham[1:-1]
    if ham in ("true", "false"):
        return ham == "true"
    try:
        return int(ham)
    except ValueError:
        pass
    try:
        return float(ham)
    except ValueError:
        return ham


def _ortama_uydur(ornek, ham):
    """Ortam değişkeni her zaman metindir; varsayılanın tipine çeviririz."""
    if isinstance(ornek, bool):
        return ham.strip().lower() in ("1", "true", "evet", "yes", "on")
    if isinstance(ornek, int):
        try:
            return int(ham)
        except ValueError:
            return ornek
    if isinstance(ornek, float):
        try:
            return float(ham)
        except ValueError:
            return ornek
    return ham


def _varsayilan_yol():
    # ai_client/ayar.py -> ses-metin/ayarlar.toml
    kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(kok, "ayarlar.toml")


class Bolum(dict):
    """Ayar bölümü. Hem d["model"] hem d.model ile okunur."""

    def __getattr__(self, ad):
        try:
            return self[ad]
        except KeyError:
            raise AttributeError(ad)


class Ayar:
    """Okunmuş ayarlar. `ayar.ses.model`, `ayar.metin.adres` gibi kullanılır."""

    def __init__(self, veri):
        self._veri = veri
        for ad, degerler in veri.items():
            setattr(self, ad, Bolum(degerler))

    @classmethod
    def yukle(cls, yol=None):
        """Varsayılan + dosya + ortam değişkenlerini bu sırayla birleştirir."""
        veri = {ad: dict(d) for ad, d in VARSAYILAN.items()}

        yol = yol or os.environ.get(ONEK + "_AYAR") or _varsayilan_yol()
        if os.path.exists(yol):
            with open(yol, encoding="utf-8") as f:
                dosya = _toml_oku(f.read())
            for bolum, degerler in dosya.items():
                veri.setdefault(bolum, {})
                if isinstance(degerler, dict):
                    veri[bolum].update(degerler)

        for bolum, degerler in veri.items():
            for anahtar in list(degerler):
                cevre = "%s_%s_%s" % (ONEK, bolum.upper(), anahtar.upper())
                if cevre in os.environ:
                    degerler[anahtar] = _ortama_uydur(
                        degerler[anahtar], os.environ[cevre])

        return cls(veri)

    def sozluk(self):
        return {ad: dict(d) for ad, d in self._veri.items()}
