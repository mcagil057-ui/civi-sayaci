# -*- coding: utf-8 -*-
"""Metin normalizasyonu — karşılaştırmadan önce iki metni ortak forma indirir.

Noktalama ve büyük/küçük harf farkı yok sayılır (PROJE.md, 5. madde).
Bunun ötesinde her dilin kendi tuzağı var; ikisini ayrı ele alıyoruz.

TÜRKÇE
  - Büyük/küçük harf: Python'un .lower() metodu Türkçede yanlış çalışır.
    'I'.lower() 'i' verir ama Türkçede 'ı' olmalı; 'İ'.lower() ise 'i' değil
    noktalı bir birleşik üretir. Bu yüzden önce elle eşleyip sonra .lower().
  - Şapkalı harfler: referans metinde "kâğıt", Whisper'da "kağıt" çıkar.
    Aynı kelime; şapka atılır.
  - Kesme işareti: "Ankara'da" ile "Ankarada" aynı sayılır.
  - Rakamlar: Whisper bazen "5", bazen "beş" yazar. Referans metin hangisini
    içerirse içersin eşleşsin diye rakamlar yazıya çevrilir. Bu olmazsa
    kullanıcı doğru okuduğu halde sistem onu yanlışlar.

ARAPÇA
  Kurallar depodaki mevcut tilavet motorundan (tilavet/engine.js) ve veri
  üreticisinden (tools/veri-uret.py) birebir alınmıştır. İki yerde iki farklı
  kural olsaydı ekrandaki metinle eşleştirilen metin birbirini tutmazdı.
"""
import re
import unicodedata

# ==========================================================================
# Türkçe
# ==========================================================================

# .lower() çağrılmadan ÖNCE uygulanır; Türkçenin i/ı ayrımını korur.
TR_KUCUK = {"I": "ı", "İ": "i", "Ş": "ş", "Ğ": "ğ", "Ü": "ü", "Ö": "ö",
            "Ç": "ç"}

# Şapkalı ve uzatmalı biçimler düz karşılıklarına iner.
TR_DUZ = {"â": "a", "ā": "a", "ä": "a", "î": "i", "ī": "i", "ï": "i",
          "û": "u", "ū": "u", "ô": "o", "ō": "o", "ê": "e", "ē": "e"}

# Kesme işaretinin bütün türleri: düz, eğik, ters, tırnak.
TR_KESME = re.compile("['’‘ʼ´`]")

# Harf, rakam ve boşluk dışında ne varsa boşluğa döner.
TR_TUT = re.compile(r"[^0-9a-zçğıöşü ]")

BIRLER = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz",
          "dokuz"]
ONLAR = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş",
         "seksen", "doksan"]
BASAMAK = [(10 ** 9, "milyar"), (10 ** 6, "milyon"), (1000, "bin")]


def sayi_yaziya(n):
    """1234 -> 'bin iki yüz otuz dört'. Türkçenin kuralları gömülü:
    'bir bin' değil 'bin', 'bir yüz' değil 'yüz'."""
    if n == 0:
        return "sıfır"
    if n < 0:
        return "eksi " + sayi_yaziya(-n)
    parcalar = []
    for deger, ad in BASAMAK:
        if n >= deger:
            adet = n // deger
            n %= deger
            # "bir milyon" denir ama "bir bin" denmez, sadece "bin".
            if adet == 1 and deger == 1000:
                parcalar.append(ad)
            else:
                parcalar.append(sayi_yaziya(adet))
                parcalar.append(ad)
    if n >= 100:
        yuz = n // 100
        n %= 100
        if yuz > 1:                      # "bir yüz" değil, "yüz"
            parcalar.append(BIRLER[yuz])
        parcalar.append("yüz")
    if n >= 10:
        parcalar.append(ONLAR[n // 10])
        n %= 10
    if n > 0:
        parcalar.append(BIRLER[n])
    return " ".join(p for p in parcalar if p)


_RAKAM = re.compile(r"\d+")


def _rakamlari_ac(metin):
    def degistir(m):
        try:
            return " " + sayi_yaziya(int(m.group())) + " "
        except (ValueError, IndexError):
            return m.group()
    return _RAKAM.sub(degistir, metin)


def turkce(metin):
    if not metin:
        return ""
    t = "".join(TR_KUCUK.get(c, c) for c in metin).lower()
    t = "".join(TR_DUZ.get(c, c) for c in t)
    t = TR_KESME.sub("", t)              # "ankara'da" -> "ankarada"
    t = _rakamlari_ac(t)
    t = TR_TUT.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


# ==========================================================================
# Arapça  (kaynak: tilavet/engine.js + tools/veri-uret.py — birebir aynı)
# ==========================================================================

# Kurallar tools/veri-uret.py ve tilavet/engine.js ile BİREBİR aynıdır;
# testler/test_normalize.py bunu her çalıştırmada doğrular.
#
# Karakterler bilerek \uXXXX kaçışıyla yazıldı, glif olarak değil. Sebep:
# bunlar birleşen (combining) işaretler ve düzenleyicide görsel sırayla
# saklanma sırası farklıdır — "\u0610-\u061A\u064B-\u065F" ekranda
# "ؐ-ً" + "ؚ-ٟ" gibi görünür. Glif kopyalanırsa aralık kayar ve desen
# Arap harflerinin tamamını silecek hale gelir.

# Osmanî hatta üste yazılan küçük harfler telaffuz edilir; silinmez,
# tam harfe çevrilir:  küçük elif -> elif, küçük vav -> vav, küçük ye -> ye.
AR_ONCE = {"\u0670": "\u0627", "\u06E5": "\u0648", "\u06E6": "\u064A"}

# Tamamen atılanlar:
#   \u0610-\u061A  Kur'an'a özgü şeref/durak işaretleri
#   \u064B-\u065F  hareke ve tenvin
#   \u06D6-\u06ED  tecvid / secâvend işaretleri
#   \u0640          tatvil (uzatma çizgisi, ses taşımaz)
#   \u08D3-\u08FF  genişletilmiş Arapça işaretler
#   \u200B-\u200F  sıfır genişlikli ve yön imleri
AR_AT = re.compile("[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED"
                   "\u0640\u08D3-\u08FF\u200B-\u200F]")

# Yazım varyantlarını tek forma indirger: hemzeli elifler -> düz elif,
# elif maksûre -> ye, ta-marbuta -> he, hemze taşıyıcıları -> vav / ye.
AR_HARF = {"\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627",
           "\u0671": "\u0627", "\u0672": "\u0627", "\u0673": "\u0627",
           "\u0649": "\u064A", "\u0629": "\u0647", "\u0624": "\u0648",
           "\u0626": "\u064A"}

# Arap harfleri ve boşluk dışında ne varsa boşluğa döner.
AR_TUT = re.compile("[^\u0621-\u064A ]")
HEMZE = "\u0621"
ELIF = "\u0627"


def arapca(metin):
    if not metin:
        return ""
    t = "".join(AR_ONCE.get(c, c) for c in metin)
    t = AR_AT.sub("", t)
    t = "".join(AR_HARF.get(c, c) for c in t)
    t = t.replace(HEMZE, "")        # tek başına hemze
    t = AR_TUT.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def iskelet(kelime):
    """Sessiz iskelet — yalnızca Arapça için anlamlı.

    Osmanî imlâ ile modern imlâ arasındaki farkın neredeyse tamamı eliften
    gelir (العالمين / العلمين). Elif atılıp yinelenen harfler tekleştirilince
    iki yazım aynı forma iner. Vav ve ye'ye dokunulmaz; onlar çoğu yerde
    gerçek sessizdir.
    """
    if not kelime:
        return ""
    s, onceki = [], ""
    for c in kelime:
        if c == ELIF:
            continue
        if c != onceki:
            s.append(c)
            onceki = c
    return "".join(s) or kelime


# ==========================================================================
# Ortak giriş
# ==========================================================================

DILLER = {"tr": turkce, "ar": arapca}


def normalize(metin, dil="tr"):
    """Dil koduna göre doğru normalizasyonu uygular.

    Bilinmeyen bir dil gelirse metni düşürmek yerine genel bir temizlik
    yaparız: uygulamanın üçüncü bir dille de çalışması gerekebilir.
    """
    islev = DILLER.get((dil or "tr").lower()[:2])
    if islev:
        return islev(metin)
    return _genel(metin)


def _genel(metin):
    """Dil bilinmiyorsa: küçült, işaretleri ayıkla, noktalamayı at."""
    if not metin:
        return ""
    t = unicodedata.normalize("NFKD", metin.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = "".join(c if (c.isalnum() or c.isspace()) else " " for c in t)
    return re.sub(r"\s+", " ", t).strip()


def kelimeler(metin, dil="tr"):
    """Normalize edip kelimelere böler. Karşılaştırmanın girdisi budur."""
    n = normalize(metin, dil)
    return n.split(" ") if n else []
