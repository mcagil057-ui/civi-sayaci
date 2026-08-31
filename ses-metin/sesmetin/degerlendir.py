# -*- coding: utf-8 -*-
"""Karşılaştırma sonucundan kısa bir değerlendirme cümlesi üretir.

Boru hattının en az kritik adımı burasıdır: yüzde ve kelime farkları
matematikle çıkar, buradaki model yalnızca sonucu insan cümlesine döker.
Bu yüzden model erişilemezse ya da boş dönerse şablona düşülür — uygulama
durmaz, sadece cümle sadeleşir.

Modelin uydurmasını engellemek için istem yalnızca hazır sayıları içerir;
modelden yorum değil, cümleye dökme istenir.
"""
from ai_client.metin import MetinHatasi

SISTEM = (
    "Sen bir Türkçe okuma değerlendirme yardımcısısın. Sana verilen sayıları "
    "tek bir kısa cümleye dökersin. Kurallar: yalnızca verilen sayıları "
    "kullan, yeni bilgi uydurma, tek cümle yaz, en fazla 25 kelime, "
    "doğrudan kullanıcıya seslen, madde işareti ve başlık kullanma."
)


def _ornekler(liste, alan, adet=3):
    ns = []
    for a in liste[:adet]:
        ns.append(a[alan] if isinstance(a, dict) else a)
    return ns


def istem_kur(sonuc):
    """Sonuç nesnesinden modele verilecek metni kurar."""
    satirlar = [
        "Bir kullanıcı verilen metni sesli okudu. Ölçüm sonuçları:",
        "- uyuşma yüzdesi: %.1f" % sonuc.uyusma,
        "- referanstaki kelime sayısı: %d" % sonuc.referans_sayisi,
        "- doğru okunan: %d" % (len(sonuc.dogru) + len(sonuc.yakin)),
        "- atlanan (hiç okunmayan): %d" % len(sonuc.eksik),
        "- yanlış okunan: %d" % len(sonuc.yanlis),
        "- fazladan söylenen: %d" % len(sonuc.fazla),
    ]
    if sonuc.eksik:
        satirlar.append("- atlanan kelimelerden örnek: %s"
                        % ", ".join(_ornekler(sonuc.eksik, "beklenen")))
    if sonuc.yanlis:
        ciftler = ["%s yerine %s" % (a["beklenen"], a["soylenen"])
                   for a in sonuc.yanlis[:3]]
        satirlar.append("- yanlış okunanlardan örnek: %s" % ", ".join(ciftler))
    if sonuc.fazla:
        satirlar.append("- fazladan söylenenlerden örnek: %s"
                        % ", ".join(_ornekler(sonuc.fazla, "soylenen")))
    satirlar.append("")
    satirlar.append("Bu sonuçları özetleyen tek bir kısa Türkçe cümle yaz.")
    return "\n".join(satirlar)


def sablon_cumle(sonuc):
    """Model olmadan kurulan cümle. Yedek değil, tam anlamıyla çalışan yol."""
    y = sonuc.uyusma
    if sonuc.referans_sayisi == 0:
        return "Karşılaştırılacak referans metin boş."
    if sonuc.soylenen_sayisi == 0:
        return "Ses kaydında konuşma bulunamadı; metnin hiçbir kısmı okunmamış."

    if y >= 95:
        bas = "Metni neredeyse birebir okudun"
    elif y >= 85:
        bas = "Metni büyük ölçüde doğru okudun"
    elif y >= 70:
        bas = "Okuman genel olarak tuttu"
    elif y >= 50:
        bas = "Okuman metinden belirgin biçimde ayrıldı"
    else:
        bas = "Okunan metin referansla büyük ölçüde uyuşmuyor"

    ayrinti = []
    if sonuc.eksik:
        ayrinti.append("%d kelime atladın" % len(sonuc.eksik))
    if sonuc.yanlis:
        ayrinti.append("%d kelimeyi farklı söyledin" % len(sonuc.yanlis))
    if sonuc.fazla:
        ayrinti.append("%d fazladan kelime ekledin" % len(sonuc.fazla))

    if not ayrinti:
        return "%s — uyuşma %%%.0f." % (bas, y)
    return "%s (uyuşma %%%.0f); %s." % (bas, y, _ve(ayrinti))


def _ve(parcalar):
    if len(parcalar) == 1:
        return parcalar[0]
    return ", ".join(parcalar[:-1]) + " ve " + parcalar[-1]


def degerlendir(sonuc, istemci=None):
    """Değerlendirme cümlesini döndürür: (cumle, kaynak).

    kaynak: "model" ya da "sablon" — arayüz hangisinin kullanıldığını
    gösterebilsin diye. Sessizce yedeğe düşmek kullanıcıyı yanıltır.
    """
    if istemci is None:
        return sablon_cumle(sonuc), "sablon"
    try:
        cumle = istemci.uret(istem_kur(sonuc), sistem=SISTEM)
    except MetinHatasi:
        return sablon_cumle(sonuc), "sablon"
    cumle = (cumle or "").strip()
    if not cumle:
        return sablon_cumle(sonuc), "sablon"
    # Model bazen madde işaretiyle ya da birden çok satırla döner; ilk
    # anlamlı satırı alıp tek cümleye indiriyoruz.
    for satir in cumle.splitlines():
        satir = satir.strip().lstrip("-*• ").strip()
        if satir:
            return satir, "model"
    return sablon_cumle(sonuc), "sablon"
