# -*- coding: utf-8 -*-
"""Normalizasyon testleri. Model gerektirmez."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sesmetin.normalize import (arapca, iskelet, kelimeler, normalize,
                                sayi_yaziya, turkce)

KOK = os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))))


class TurkceTest(unittest.TestCase):
    def test_noktalama_ve_buyuk_kucuk_yok_sayilir(self):
        # PROJE.md 5. madde: noktalama ve büyük/küçük harf farkı yok sayılsın.
        self.assertEqual(turkce("Bugün hava güzel!"), turkce("bugün hava güzel"))
        self.assertEqual(turkce("Merhaba, dünya."), "merhaba dünya")

    def test_turkce_buyuk_kucuk_dogru(self):
        # Python'un .lower() metodu tek başına burada yanlış sonuç verir.
        self.assertEqual(turkce("KIRMIZI"), "kırmızı")
        self.assertEqual(turkce("İSTANBUL"), "istanbul")
        self.assertEqual(turkce("Işık"), "ışık")

    def test_sapka_atilir(self):
        self.assertEqual(turkce("kâğıt"), turkce("kağıt"))
        self.assertEqual(turkce("rüzgâr"), "rüzgar")

    def test_kesme_isareti(self):
        self.assertEqual(turkce("Ankara'da"), turkce("Ankarada"))
        self.assertEqual(turkce("Ali’nin"), turkce("Alinin"))

    def test_rakam_yaziya_cevrilir(self):
        # Whisper bazen rakam, bazen yazı üretir; ikisi eşleşmeli.
        self.assertEqual(turkce("5 elma"), turkce("beş elma"))
        self.assertEqual(turkce("saat 15"), turkce("saat on beş"))

    def test_sayi_yaziya(self):
        for sayi, beklenen in [(0, "sıfır"), (5, "beş"), (15, "on beş"),
                               (100, "yüz"), (101, "yüz bir"), (1000, "bin"),
                               (1234, "bin iki yüz otuz dört"),
                               (2000000, "iki milyon")]:
            self.assertEqual(sayi_yaziya(sayi), beklenen, sayi)

    def test_bos_girdi(self):
        self.assertEqual(turkce(""), "")
        self.assertEqual(turkce(None), "")
        self.assertEqual(kelimeler("", "tr"), [])


class ArapcaTest(unittest.TestCase):
    def test_hareke_ve_tecvid_atilir(self):
        self.assertEqual(arapca("ٱلۡحَمۡدُ لِلَّهِ"), "الحمد لله")

    def test_iskelet_imla_farkini_kapatir(self):
        # Osmanî ve modern imlâ aynı iskelete inmeli.
        self.assertEqual(iskelet(arapca("ٱلۡعَٰلَمِينَ")),
                         iskelet(arapca("العلمين")))

    def test_depodaki_kurallarla_birebir_ayni(self):
        """tools/veri-uret.py ile aynı sonucu vermeli.

        Depo bu iki uygulamanın ayrışmaması gerektiğini açıkça söylüyor:
        biri değişirse ekrandaki metinle eşleştirme metni birbirini tutmaz.
        Bu test o sözleşmeyi bağlar.
        """
        kaynak_yolu = os.path.join(KOK, "tools", "veri-uret.py")
        if not os.path.exists(kaynak_yolu):
            self.skipTest("tools/veri-uret.py bulunamadı")
        with open(kaynak_yolu, encoding="utf-8") as f:
            kaynak = f.read()
        parcalar = []
        for ad in ("PRE", "STRIP", "KEEP"):
            parcalar.append("%s = %s" % (
                ad, re.search(r"^%s = (.+)$" % ad, kaynak, re.M).group(1)))
        parcalar.append("LETTER = " + re.search(
            r"^LETTER = (\{.*?\})$", kaynak, re.M | re.S).group(1))
        parcalar.append(re.search(r"^def normalize\(text\):.*?(?=\n\S)",
                                  kaynak, re.M | re.S).group(0))
        ns = {"re": re}
        exec("\n".join(parcalar), ns)

        ornekler = ["ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ",
                    "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ",
                    "مَٰلِكِ يَوۡمِ ٱلدِّينِ",
                    "إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ",
                    "قُلۡ هُوَ ٱللَّهُ أَحَدٌ"]
        for o in ornekler:
            self.assertEqual(arapca(o), ns["normalize"](o), o)


class DilSecimiTest(unittest.TestCase):
    def test_dil_kodu_yonlendirir(self):
        self.assertEqual(normalize("Kâğıt", "tr"), "kağıt")
        self.assertEqual(normalize("ٱلۡحَمۡدُ", "ar"), "الحمد")

    def test_bilinmeyen_dil_metni_dusurmez(self):
        # Üçüncü bir dil gelirse genel temizliğe düşmeli, boş dönmemeli.
        sonuc = normalize("Hello, World!", "en")
        self.assertTrue(sonuc)
        self.assertNotIn(",", sonuc)


if __name__ == "__main__":
    unittest.main(verbosity=2)
