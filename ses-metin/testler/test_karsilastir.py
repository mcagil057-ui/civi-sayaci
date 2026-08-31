# -*- coding: utf-8 -*-
"""Karşılaştırma testleri. Model gerektirmez."""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sesmetin import karsilastir as K
from sesmetin.karsilastir import karsilastir


class TemelTest(unittest.TestCase):
    def test_birebir_okuma_yuzde_yuz(self):
        s = karsilastir("Bugün hava çok güzel, dışarı çıkalım.",
                        "bugün hava çok güzel dışarı çıkalım", "tr")
        self.assertEqual(s.uyusma, 100.0)
        self.assertEqual(len(s.yanlis), 0)

    def test_atlanan_kelime_kaymaya_yol_acmaz(self):
        """Bu testin varlık sebebi: naif karşılaştırmada tek bir atlama,
        sonraki bütün kelimeleri yanlış gösterir."""
        s = karsilastir("bir iki üç dört beş altı yedi",
                        "bir iki dört beş altı yedi", "tr")
        self.assertEqual(len(s.eksik), 1)
        self.assertEqual(s.eksik[0]["beklenen"], "üç")
        self.assertEqual(len(s.yanlis), 0, "kayma olmamalı")
        self.assertEqual(len(s.dogru), 6)

    def test_fazladan_kelime(self):
        s = karsilastir("kapıyı aç", "kapıyı hemen aç", "tr")
        self.assertEqual([a["soylenen"] for a in s.fazla], ["hemen"])
        self.assertEqual(len(s.yanlis), 0)

    def test_yanlis_kelime(self):
        s = karsilastir("kırmızı arabayı gördüm", "mavi arabayı gördüm", "tr")
        self.assertEqual(len(s.yanlis), 1)
        self.assertEqual(s.yanlis[0]["beklenen"], "kırmızı")
        self.assertEqual(s.yanlis[0]["soylenen"], "mavi")

    def test_bastan_atlama(self):
        s = karsilastir("bir iki üç", "iki üç", "tr")
        self.assertEqual([a["beklenen"] for a in s.eksik], ["bir"])

    def test_sondan_atlama(self):
        s = karsilastir("bir iki üç", "bir iki", "tr")
        self.assertEqual([a["beklenen"] for a in s.eksik], ["üç"])


class ArapcaTest(unittest.TestCase):
    def test_imla_farki_hata_sayilmaz(self):
        # Osmanî referans, modern imlâ ile tanınmış: hata değil.
        s = karsilastir("ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ",
                        "الحمد لله رب العلمين", "ar")
        self.assertEqual(s.uyusma, 100.0)
        self.assertEqual(len(s.yakin), 1, "imlâ farkı 'yakın' sayılmalı")

    def test_atlanan_ayet_kelimesi(self):
        s = karsilastir("بسم الله الرحمن الرحيم", "بسم الله الرحيم", "ar")
        self.assertEqual(len(s.eksik), 1)


class SinirDurumlariTest(unittest.TestCase):
    def test_ikisi_de_bos(self):
        self.assertEqual(karsilastir("", "", "tr").uyusma, 100.0)

    def test_hic_konusulmamis(self):
        s = karsilastir("bir iki üç", "", "tr")
        self.assertEqual(s.uyusma, 0.0)
        self.assertEqual(len(s.eksik), 3)

    def test_referans_bos_ama_konusulmus(self):
        s = karsilastir("", "bir şey", "tr")
        self.assertEqual(s.uyusma, 0.0)
        self.assertEqual(len(s.fazla), 2)

    def test_tamamen_alakasiz(self):
        s = karsilastir("elma armut kiraz", "bilgisayar masası klavye", "tr")
        self.assertEqual(s.uyusma, 0.0)

    def test_yuzde_hic_negatif_olmaz(self):
        # Referanstan çok daha uzun bir konuşma hata oranını 1'in üstüne
        # çıkarır; yüzde yine de 0'da kalmalı.
        s = karsilastir("bir", " ".join(["farklı"] * 50), "tr")
        self.assertGreaterEqual(s.uyusma, 0.0)


class HizalamaYollariTest(unittest.TestCase):
    """Üç hizalama yolu da aynı sonucu vermeli.

    Tam matris doğruluk ölçütüdür; çapa ve bant yolları yalnızca hızlandırma.
    Biri saparsa uzun metinlerde sessizce yanlış rapor üretiriz.
    """

    def _sozcukler(self, adet, tohum=7):
        rastgele = random.Random(tohum)
        hece = ["ka", "le", "mi", "tu", "sor", "yan", "del", "gü", "bar",
                "çı", "nem", "ras", "top", "kes", "ıl", "fen"]
        gorulen, ns = set(), []
        while len(ns) < adet:
            k = "".join(rastgele.choice(hece)
                        for _ in range(rastgele.randint(2, 4)))
            if k not in gorulen:
                gorulen.add(k)
                ns.append(k)
        return ns

    def test_capa_yolu_tam_matrisle_ayni(self):
        ref = self._sozcukler(600)
        soy = [k for i, k in enumerate(ref) if i % 37]
        self.assertGreater(len(K._capalar(ref, soy)), 0, "çapa bulunmalı")
        self.assertEqual(K._hizala(ref, soy, "tr", 0.82),
                         K._tam_hizala(ref, soy, "tr", 0.82))

    def test_bant_yolu_tam_matrisle_ayni(self):
        ref = self._sozcukler(300, tohum=11)
        soy = [k for i, k in enumerate(ref) if i % 23]
        self.assertEqual(K._bantli_hizala(ref, soy, "tr", 0.82),
                         K._tam_hizala(ref, soy, "tr", 0.82))

    def test_tekrarli_metinde_bant_dogru_sayar(self):
        """Çapa bulunamayan (kendini tekrar eden) metin: bant yolu devreye
        girer ve atlamaları doğru saymalı."""
        ref = ["kelime", "bir"] * 300
        atlanan = set(range(0, len(ref), 47))
        soy = [k for i, k in enumerate(ref) if i not in atlanan]
        s = K.Sonuc(K._bantli_hizala(ref, soy, "tr", 0.82), "tr", 0.82)
        self.assertEqual(len(s.eksik), len(atlanan))
        self.assertEqual(len(s.yanlis), 0)

    def test_uzun_metin_makul_surede_biter(self):
        import time
        ref = self._sozcukler(4000, tohum=3)
        soy = [k for i, k in enumerate(ref) if i % 53]
        basla = time.time()
        s = K.Sonuc(K._hizala(ref, soy, "tr", 0.82), "tr", 0.82)
        sure = time.time() - basla
        self.assertLess(sure, 10.0, "4000 kelime 10 saniyeyi aşmamalı")
        self.assertEqual(len(s.eksik), len(range(0, 4000, 53)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
