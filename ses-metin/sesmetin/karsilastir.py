# -*- coding: utf-8 -*-
"""Söylenen metni referans metinle karşılaştırır.

Neden basit "kelime kelime yan yana koy" yetmez: kullanıcı tek bir kelimeyi
atlarsa, o noktadan sonraki bütün kelimeler bir sıra kayar ve hepsi yanlış
görünür. Bu yüzden önce iki dizi HİZALANIR (düzenleme mesafesi mantığı),
sonra fark çıkarılır. Böylece bir atlama tek bir "eksik" olarak raporlanır.

Beş sonuç türü var:
  dogru  : birebir aynı
  yakin  : eşik üstü benzer — Osmanî/modern imlâ farkı, ufak yazım oynaması
  yanlis : referansta bu kelime vardı, yerine başkası söylendi
  eksik  : referansta vardı, hiç söylenmedi
  fazla  : referansta yoktu, söylendi

`yakin` bilerek ayrı tutulur: sistem "bunu doğru saydım" dediği yerleri
kullanıcıya göstermeli, sessizce yutmamalı.
"""
from . import normalize as nrm

SONSUZ = float("inf")

# Bu eşiğin üstündeki benzerlik "doğru sayılır". Dile göre ayrı, çünkü:
#  - Arapçada iskelet eşleşmesi 0.92 verir; Osmanî/modern imlâ farkı hata
#    değildir, eşik bunun altında olmalı.
#  - Türkçede ek başlı başına anlam taşır ("geldi"/"geldim" farklı kelimeler),
#    o yüzden daha sıkı.
VARSAYILAN_ESIK = {"tr": 0.82, "ar": 0.85}

# Bu hücre sayısının altındaki parçalar tam matrisle hizalanır (~200x200,
# yaşlı bir makinede yarım saniye). Üstünde
# kalanlar önce çapalardan bölünür (bkz. _hizala).
TAM_SINIR = 40_000


def _levenshtein(a, b, tavan):
    """Düzenleme mesafesi. `tavan` aşılırsa erken çıkar — çoğu kelime çifti
    birbirine hiç benzemez, tam mesafeyi hesaplamak israf olur."""
    la, lb = len(a), len(b)
    if abs(la - lb) > tavan:
        return tavan + 1
    onceki = list(range(lb + 1))
    for i in range(1, la + 1):
        simdi = [i] + [0] * lb
        enaz = i
        ai = a[i - 1]
        for j in range(1, lb + 1):
            bedel = 0 if ai == b[j - 1] else 1
            simdi[j] = min(onceki[j] + 1, simdi[j - 1] + 1, onceki[j - 1] + bedel)
            if simdi[j] < enaz:
                enaz = simdi[j]
        if enaz > tavan:
            return tavan + 1
        onceki = simdi
    return onceki[lb]


def kelime_benzerligi(a, b, dil="tr"):
    """0..1 arası benzerlik. Ucuzdan pahalıya kademeli bakar."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # Arapçada imlâ farkının neredeyse tamamı eliften gelir; iskelet ikisini
    # aynı forma indirir. Türkçede böyle bir sadeleştirme yok — sesli harfi
    # atmak "kar"/"kir"/"kür" kelimelerini birleştirir, işe yaramaz.
    if dil == "ar" and nrm.iskelet(a) == nrm.iskelet(b):
        return 0.92
    m = max(len(a), len(b))
    oran_tavani = 0.30 if dil == "tr" else 0.35
    tavan = int(m * oran_tavani)
    if tavan < 1:
        return 0.0
    d = _levenshtein(a, b, tavan)
    if d > tavan:
        return 0.0
    oran = 1.0 - d / m
    return oran * 0.9 if oran >= 0.7 else 0.0


def _adim(tur, benzerlik, ref_kelime, soy_kelime, esik):
    """Hizalama adımını sonuç türüne çevirir."""
    if tur != "esle":
        if tur == "eksik":
            return {"tur": "eksik", "beklenen": ref_kelime}
        return {"tur": "fazla", "soylenen": soy_kelime}
    if benzerlik >= 1.0:
        etiket = "dogru"
    elif benzerlik >= esik:
        etiket = "yakin"
    else:
        etiket = "yanlis"
    return {"tur": etiket, "beklenen": ref_kelime, "soylenen": soy_kelime,
            "benzerlik": round(benzerlik, 3)}


def _tam_hizala(referans, soylenen, dil, esik):
    """Tam matris hizalama. Küçük parçalar için; en doğru sonucu verir.

    Bedeller: eşleştirme 1-benzerlik, atlama 1, fazladan söyleme 1.
    """
    n, m = len(referans), len(soylenen)
    if n == 0:
        return [{"tur": "fazla", "soylenen": k} for k in soylenen]
    if m == 0:
        return [{"tur": "eksik", "beklenen": k} for k in referans]

    D = [[0.0] * (m + 1) for _ in range(n + 1)]
    izler = [[None] * (m + 1) for _ in range(n + 1)]
    for j in range(1, m + 1):
        D[0][j] = float(j)
        izler[0][j] = ("fazla", 0.0)
    for i in range(1, n + 1):
        D[i][0] = float(i)
        izler[i][0] = ("eksik", 0.0)

    for i in range(1, n + 1):
        ri = referans[i - 1]
        onceki_satir, simdi_satir = D[i - 1], D[i]
        iz_satiri = izler[i]
        for j in range(1, m + 1):
            sj = soylenen[j - 1]
            # En sık durum burası: kelime birebir tutuyor. Benzerlik
            # fonksiyonunu hiç çağırmadan geçmek uzun metinlerde
            # işin en büyük kısmını eler.
            benzerlik = 1.0 if ri == sj else kelime_benzerligi(ri, sj, dil)
            en_iyi = onceki_satir[j - 1] + (1.0 - benzerlik)
            iz = ("esle", benzerlik)
            aday = onceki_satir[j] + 1.0
            if aday < en_iyi:
                en_iyi, iz = aday, ("eksik", 0.0)
            aday = simdi_satir[j - 1] + 1.0
            if aday < en_iyi:
                en_iyi, iz = aday, ("fazla", 0.0)
            simdi_satir[j] = en_iyi
            iz_satiri[j] = iz

    adimlar, i, j = [], n, m
    while i > 0 or j > 0:
        tur, benzerlik = izler[i][j]
        adimlar.append(_adim(tur, benzerlik,
                             referans[i - 1] if i > 0 else None,
                             soylenen[j - 1] if j > 0 else None, esik))
        if tur == "esle":
            i -= 1
            j -= 1
        elif tur == "eksik":
            i -= 1
        else:
            j -= 1
    adimlar.reverse()
    return adimlar


def _capalar(referans, soylenen):
    """İki dizide de TAM OLARAK BİR KEZ geçen ortak kelimeler.

    Böyle bir kelime sabit noktadır: iki metinde de tek olduğu için hangi
    eşleşmeye ait olduğu belirsiz değildir. Sesli okumada içerik kelimeleri
    (isimler, fiiller) çoğunlukla böyledir; "ve", "bir" gibi sık kelimeler
    doğal olarak elenir.
    """
    from collections import Counter
    sayim_r = Counter(referans)
    sayim_s = Counter(soylenen)
    tekler = {k for k, adet in sayim_r.items()
              if adet == 1 and sayim_s.get(k) == 1}
    if not tekler:
        return []
    yer_r = {k: i for i, k in enumerate(referans) if k in tekler}
    yer_s = {k: j for j, k in enumerate(soylenen) if k in tekler}
    ciftler = sorted((yer_r[k], yer_s[k]) for k in tekler)
    return _artan_altdizi(ciftler)


def _artan_altdizi(ciftler):
    """(i, j) çiftlerinden j'si de artan en uzun altdiziyi seçer.

    Gerekli, çünkü bir kelime iki metinde farklı sıralarda geçebilir
    (kullanıcı cümleyi ters söylemiştir). Çapaların birbirini kesmemesi
    lazım, yoksa bölme tutarsız olur.
    """
    import bisect
    if not ciftler:
        return []
    kuyruk_j, kuyruk_idx = [], []
    onceki = [-1] * len(ciftler)
    for idx, (_, j) in enumerate(ciftler):
        p = bisect.bisect_left(kuyruk_j, j)
        if p == len(kuyruk_j):
            kuyruk_j.append(j)
            kuyruk_idx.append(idx)
        else:
            kuyruk_j[p] = j
            kuyruk_idx[p] = idx
        onceki[idx] = kuyruk_idx[p - 1] if p > 0 else -1
    sonuc, k = [], kuyruk_idx[-1]
    while k != -1:
        sonuc.append(ciftler[k])
        k = onceki[k]
    sonuc.reverse()
    return sonuc


def _hizala(referans, soylenen, dil, esik):
    """İki kelime dizisini hizalar, sıralı işlem listesi döndürür.

    Tam matris O(n*m)'dir ve her hücrede kelime benzerliği hesaplanır; bir
    sayfalık metinde bu yaşlı bir makinede dakikalar sürer. Bu yüzden metin
    uzunsa önce çapalardan bölünür (bkz. _capalar), aralardaki küçük
    parçalar tam hizalanır. Sonuç kalitesi düşmez — aksine, uzak
    eşleşmelerin yanlışlıkla birbirine bağlanması da engellenir.
    """
    n, m = len(referans), len(soylenen)
    if n == 0 or m == 0 or n * m <= TAM_SINIR:
        return _tam_hizala(referans, soylenen, dil, esik)

    capalar = _capalar(referans, soylenen)
    if not capalar:
        # Hiç ortak tek kelime yok: iki metin muhtemelen alakasız.
        # Bölecek yer olmadığı için köşegen bandıyla yetiniyoruz.
        return _bantli_hizala(referans, soylenen, dil, esik)

    adimlar = []
    onceki_i = onceki_j = 0
    for i, j in capalar:
        adimlar.extend(_hizala(referans[onceki_i:i], soylenen[onceki_j:j],
                               dil, esik))
        adimlar.append({"tur": "dogru", "beklenen": referans[i],
                        "soylenen": soylenen[j], "benzerlik": 1.0})
        onceki_i, onceki_j = i + 1, j + 1
    adimlar.extend(_hizala(referans[onceki_i:], soylenen[onceki_j:],
                           dil, esik))
    return adimlar


def _bantli_hizala(referans, soylenen, dil, esik):
    """Çapa bulunamayan uzun parçalar için köşegen bandıyla tam DP.

    Buraya yalnızca iki metinde de tek başına geçen ortak kelime yoksa
    gelinir; yani metin baştan sona kendini tekrar ediyordur. Tam matris
    o boyutta hem yavaş hem bellek yiyicidir, bu yüzden köşegenin
    çevresindeki bant dışında kalan hücreler hesaplanmaz.

    Bant, iki metin arasındaki uzunluk farkı kadar net kaymayı taşıyacak
    genişlikte seçilir; böylece atlama ve fazladan söyleme normal DP'deki
    gibi işlenir. (Önceki sürüm köşegende düz yürüyordu ve tek bir atlama
    sonrası her şeyi yanlış gösteriyordu.)
    """
    n, m = len(referans), len(soylenen)
    if n == 0 or m == 0:
        return _tam_hizala(referans, soylenen, dil, esik)

    ESLE, EKSIK, FAZLA = 0, 1, 2
    bant = min(m, max(64, abs(n - m) + 32, (m // n if n else 0) + 32))

    def sinirlar(i):
        merkez = i * m // n
        return max(0, merkez - bant), min(m, merkez + bant)

    def benzerlik_of(i, j):
        a, b = referans[i - 1], soylenen[j - 1]
        return 1.0 if a == b else kelime_benzerligi(a, b, dil)

    # Satır 0
    alt, ust = sinirlar(0)
    alt = 0
    onceki = [float(j) for j in range(alt, ust + 1)]
    onceki_alt = alt
    izler = [(alt, bytearray([FAZLA]) * (ust - alt + 1))]

    for i in range(1, n + 1):
        alt, ust = sinirlar(i)
        if i == n:
            ust = m                       # son satır m'yi içermek zorunda
        genislik = ust - alt + 1
        simdi = [SONSUZ] * genislik
        islemler = bytearray(genislik)
        for j in range(alt, ust + 1):
            k = j - alt
            if j == 0:
                simdi[k] = float(i)
                islemler[k] = EKSIK
                continue
            en_iyi, islem = SONSUZ, EKSIK
            p = j - 1 - onceki_alt                    # eşleştir
            if 0 <= p < len(onceki) and onceki[p] < SONSUZ:
                aday = onceki[p] + (1.0 - benzerlik_of(i, j))
                if aday < en_iyi:
                    en_iyi, islem = aday, ESLE
            p = j - onceki_alt                        # eksik (atlanmış)
            if 0 <= p < len(onceki) and onceki[p] < SONSUZ:
                aday = onceki[p] + 1.0
                if aday < en_iyi:
                    en_iyi, islem = aday, EKSIK
            if k > 0 and simdi[k - 1] < SONSUZ:       # fazla (eklenmiş)
                aday = simdi[k - 1] + 1.0
                if aday < en_iyi:
                    en_iyi, islem = aday, FAZLA
            simdi[k] = en_iyi
            islemler[k] = islem
        izler.append((alt, islemler))
        onceki, onceki_alt = simdi, alt

    adimlar, i, j = [], n, m
    while i > 0 or j > 0:
        if i == 0:
            adimlar.append({"tur": "fazla", "soylenen": soylenen[j - 1]})
            j -= 1
            continue
        if j == 0:
            adimlar.append({"tur": "eksik", "beklenen": referans[i - 1]})
            i -= 1
            continue
        alt, islemler = izler[i]
        k = j - alt
        if not (0 <= k < len(islemler)):
            # Bandın dışına düştük: kalanı eksik/fazla olarak boşalt.
            adimlar.append({"tur": "eksik", "beklenen": referans[i - 1]})
            i -= 1
            continue
        islem = islemler[k]
        if islem == ESLE:
            adimlar.append(_adim("esle", benzerlik_of(i, j),
                                 referans[i - 1], soylenen[j - 1], esik))
            i -= 1
            j -= 1
        elif islem == EKSIK:
            adimlar.append({"tur": "eksik", "beklenen": referans[i - 1]})
            i -= 1
        else:
            adimlar.append({"tur": "fazla", "soylenen": soylenen[j - 1]})
            j -= 1
    adimlar.reverse()
    return adimlar


class Sonuc:
    """Karşılaştırma sonucu. Hem rapora hem arayüze yeter."""

    def __init__(self, hizalama, dil, esik):
        self.hizalama = hizalama          # sıralı; arayüz metni boyayabilir
        self.dil = dil
        self.esik = esik
        self.dogru = [a for a in hizalama if a["tur"] == "dogru"]
        self.yakin = [a for a in hizalama if a["tur"] == "yakin"]
        self.yanlis = [a for a in hizalama if a["tur"] == "yanlis"]
        self.eksik = [a for a in hizalama if a["tur"] == "eksik"]
        self.fazla = [a for a in hizalama if a["tur"] == "fazla"]
        self.referans_sayisi = (len(self.dogru) + len(self.yakin)
                                + len(self.yanlis) + len(self.eksik))
        self.soylenen_sayisi = (len(self.dogru) + len(self.yakin)
                                + len(self.yanlis) + len(self.fazla))
        hata = len(self.yanlis) + len(self.eksik) + len(self.fazla)
        if self.referans_sayisi == 0:
            # Referans boşsa: söylenen de boşsa kusursuz, değilse tamamı fazla.
            self.hata_orani = 0.0 if self.soylenen_sayisi == 0 else 1.0
        else:
            self.hata_orani = hata / self.referans_sayisi
        self.uyusma = round(max(0.0, 1.0 - self.hata_orani) * 100, 1)

    def sozluk(self):
        return {
            "uyusma": self.uyusma,
            "hata_orani": round(self.hata_orani, 4),
            "dil": self.dil,
            "referans_sayisi": self.referans_sayisi,
            "soylenen_sayisi": self.soylenen_sayisi,
            "dogru_sayisi": len(self.dogru),
            "yakin": [{"beklenen": a["beklenen"], "soylenen": a["soylenen"],
                       "benzerlik": a["benzerlik"]} for a in self.yakin],
            "yanlis": [{"beklenen": a["beklenen"], "soylenen": a["soylenen"]}
                       for a in self.yanlis],
            "eksik": [a["beklenen"] for a in self.eksik],
            "fazla": [a["soylenen"] for a in self.fazla],
            "hizalama": self.hizalama,
        }

    def __repr__(self):
        return ("Sonuc(uyusma=%.1f%%, yanlis=%d, eksik=%d, fazla=%d)"
                % (self.uyusma, len(self.yanlis), len(self.eksik),
                   len(self.fazla)))


def karsilastir(referans_metin, soylenen_metin, dil="tr", esik=None):
    """Referans metinle söylenen metni karşılaştırır.

    Noktalama ve büyük/küçük harf farkı normalizasyonda düşer; buraya
    gelen iki dizi zaten ortak formdadır.
    """
    dil = (dil or "tr").lower()[:2]
    if esik is None:
        esik = VARSAYILAN_ESIK.get(dil, 0.82)
    referans = nrm.kelimeler(referans_metin, dil)
    soylenen = nrm.kelimeler(soylenen_metin, dil)
    return Sonuc(_hizala(referans, soylenen, dil, esik), dil, esik)
