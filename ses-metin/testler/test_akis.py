# -*- coding: utf-8 -*-
"""ai_client katmanı ve uçtan uca akış testleri. Model gerektirmez."""
import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, KOK)

import ai_client
from ai_client.ayar import Ayar
from ai_client.metin import MetinHatasi, OllamaMetin, SablonMetin
from sesmetin import akis
from sesmetin.degerlendir import degerlendir, sablon_cumle
from sesmetin.karsilastir import karsilastir


class AyarTest(unittest.TestCase):
    def test_varsayilanlar_dosyasiz_calisir(self):
        ayar = Ayar.yukle("/olmayan/ayarlar.toml")
        self.assertEqual(ayar.ses.model, "small")
        self.assertEqual(ayar.metin.saglayici, "ollama")

    def test_dosyadan_okur(self):
        with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False,
                                         encoding="utf-8") as f:
            f.write('[ses]\nmodel = "tiny"\n[metin]\nadres = "http://a:1"\n')
            yol = f.name
        try:
            ayar = Ayar.yukle(yol)
            self.assertEqual(ayar.ses.model, "tiny")
            self.assertEqual(ayar.metin.adres, "http://a:1")
            # Dosyada olmayan anahtarlar varsayılandan gelmeli.
            self.assertEqual(ayar.ses.hesap_tipi, "int8")
        finally:
            os.unlink(yol)

    def test_bom_lu_dosya_okunur(self):
        """Windows PowerShell 5.1'in Set-Content -Encoding UTF8 komutu
        dosyanın başına BOM koyar. Düz utf-8 ile okunursa tomllib ilk
        satırda çöker ve uygulama Windows'ta hiç açılmaz."""
        with tempfile.NamedTemporaryFile("wb", suffix=".toml",
                                         delete=False) as f:
            f.write(b"\xef\xbb\xbf" + b'[ses]\nmodel = "tiny"\n')
            yol = f.name
        try:
            ayar = Ayar.yukle(yol)
            self.assertEqual(ayar.ses.model, "tiny")
        finally:
            os.unlink(yol)

    def test_ortam_degiskeni_dosyayi_ezer(self):
        os.environ["SESMETIN_SES_MODEL"] = "base"
        os.environ["SESMETIN_METIN_ZAMAN_ASIMI"] = "7"
        try:
            ayar = Ayar.yukle()
            self.assertEqual(ayar.ses.model, "base")
            # Tip korunmalı: ortam değişkeni metindir, ayar sayı.
            self.assertEqual(ayar.metin.zaman_asimi, 7)
            self.assertIsInstance(ayar.metin.zaman_asimi, int)
        finally:
            del os.environ["SESMETIN_SES_MODEL"]
            del os.environ["SESMETIN_METIN_ZAMAN_ASIMI"]


class IstemciSecimiTest(unittest.TestCase):
    """Mimarinin can alıcı noktası: sağlayıcı yalnızca ayardan değişmeli,
    uygulama kodu hiç değişmemeli."""

    def _ayarla(self, **cevre):
        for k, v in cevre.items():
            os.environ[k] = v
        self.addCleanup(lambda: [os.environ.pop(k, None) for k in cevre])
        return Ayar.yukle()

    def test_yerel_ses(self):
        ayar = self._ayarla(SESMETIN_SES_SAGLAYICI="yerel")
        self.assertEqual(type(ai_client.ses_istemcisi(ayar)).__name__,
                         "YerelSes")

    def test_uzak_ses_sadece_adresle(self):
        ayar = self._ayarla(SESMETIN_SES_SAGLAYICI="uzak",
                            SESMETIN_SES_ADRES="http://192.168.1.9:8020")
        istemci = ai_client.ses_istemcisi(ayar)
        self.assertEqual(type(istemci).__name__, "UzakSes")
        self.assertEqual(istemci.adres, "http://192.168.1.9:8020")

    def test_sablon_metin(self):
        ayar = self._ayarla(SESMETIN_METIN_SAGLAYICI="sablon")
        self.assertIsInstance(ai_client.metin_istemcisi(ayar), SablonMetin)

    def test_bilinmeyen_saglayici_hata_verir(self):
        ayar = self._ayarla(SESMETIN_SES_SAGLAYICI="uydurma")
        with self.assertRaises(ValueError):
            ai_client.ses_istemcisi(ayar)


class SahteOllama(BaseHTTPRequestHandler):
    """Gerçek Ollama'nın yerine geçen küçük sunucu."""
    yanit = "Metni büyük ölçüde doğru okudun."
    kod = 200

    def log_message(self, *a):
        pass

    def do_GET(self):
        govde = json.dumps({"models": [{"name": "qwen2.5:3b"}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(govde)))
        self.end_headers()
        self.wfile.write(govde)

    def do_POST(self):
        uzunluk = int(self.headers.get("Content-Length") or 0)
        istek = json.loads(self.rfile.read(uzunluk))
        SahteOllama.son_istek = istek
        govde = json.dumps({"response": SahteOllama.yanit}).encode()
        self.send_response(SahteOllama.kod)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(govde)))
        self.end_headers()
        self.wfile.write(govde)


class OllamaTest(unittest.TestCase):
    def setUp(self):
        self.sunucu = HTTPServer(("127.0.0.1", 0), SahteOllama)
        self.adres = "http://127.0.0.1:%d" % self.sunucu.server_port
        threading.Thread(target=self.sunucu.serve_forever, daemon=True).start()
        self.addCleanup(self.sunucu.server_close)
        self.addCleanup(self.sunucu.shutdown)
        SahteOllama.kod = 200
        SahteOllama.yanit = "Metni büyük ölçüde doğru okudun."

    def test_cumle_uretir(self):
        istemci = OllamaMetin(self.adres, "qwen2.5:3b")
        self.assertEqual(istemci.uret("merhaba"),
                         "Metni büyük ölçüde doğru okudun.")

    def test_bellekte_tutma_gonderilir(self):
        # Yaşlı makinede modeli bellekte bırakmamak önemli; ayar gerçekten
        # istekte gitmeli.
        OllamaMetin(self.adres, "qwen2.5:3b", bellekte_tut="0s").uret("x")
        self.assertEqual(SahteOllama.son_istek["keep_alive"], "0s")
        self.assertFalse(SahteOllama.son_istek["stream"])

    def test_hazir_mi_modeli_gorur(self):
        self.assertTrue(OllamaMetin(self.adres, "qwen2.5:3b").hazir_mi())
        self.assertFalse(OllamaMetin(self.adres, "bulunmayan").hazir_mi())

    def test_ulasilamayinca_hata(self):
        istemci = OllamaMetin("http://127.0.0.1:1", "x", zaman_asimi=2)
        with self.assertRaises(MetinHatasi):
            istemci.uret("merhaba")

    def test_model_bos_donerse_sablona_dusulur(self):
        SahteOllama.yanit = "   "
        sonuc = karsilastir("bir iki üç", "bir iki", "tr")
        cumle, kaynak = degerlendir(sonuc, OllamaMetin(self.adres, "x"))
        self.assertEqual(kaynak, "sablon")
        self.assertTrue(cumle)

    def test_model_erisilemezse_sablona_dusulur(self):
        """Değerlendirme cümlesi kritik değil: model yoksa uygulama
        durmamalı, cümle sadeleşmeli."""
        sonuc = karsilastir("bir iki üç", "bir iki", "tr")
        cumle, kaynak = degerlendir(
            sonuc, OllamaMetin("http://127.0.0.1:1", "x", zaman_asimi=2))
        self.assertEqual(kaynak, "sablon")
        self.assertIn("atladın", cumle)


class DegerlendirmeTest(unittest.TestCase):
    def test_sablon_her_aralikta_cumle_verir(self):
        durumlar = [("a b c", "a b c"), ("a b c", "a b"), ("a b c", "a"),
                    ("a b c", ""), ("a b c", "x y z"), ("", "")]
        for ref, soy in durumlar:
            cumle = sablon_cumle(karsilastir(ref, soy, "tr"))
            self.assertTrue(cumle.strip(), (ref, soy))
            self.assertTrue(cumle.endswith("."), cumle)


class AkisTest(unittest.TestCase):
    def test_dosya_saglayicisiyla_uctan_uca(self):
        """Model olmadan bütün boru hattı: girdi -> çözüm -> karşılaştırma
        -> değerlendirme."""
        dizin = tempfile.mkdtemp()
        ses = os.path.join(dizin, "kayit.wav")
        open(ses, "wb").close()
        with open(os.path.join(dizin, "kayit.txt"), "w",
                  encoding="utf-8") as f:
            f.write("bugün hava çok güzel dışarı çıktım")

        os.environ["SESMETIN_SES_SAGLAYICI"] = "dosya"
        os.environ["SESMETIN_METIN_SAGLAYICI"] = "sablon"
        self.addCleanup(lambda: [os.environ.pop(k, None) for k in
                                 ("SESMETIN_SES_SAGLAYICI",
                                  "SESMETIN_METIN_SAGLAYICI")])

        rapor = akis.calistir(ses, "Bugün hava çok güzel, dışarı çıktım.",
                              dil="tr")
        self.assertEqual(rapor["uyusma"], 100.0)
        self.assertEqual(rapor["dil"], "tr")
        self.assertEqual(rapor["degerlendirme_kaynagi"], "sablon")
        self.assertTrue(rapor["degerlendirme"])
        self.assertIn("toplam", rapor["sureler"])

    def test_metinden_ses_adimini_atlar(self):
        rapor = akis.metinden("bir iki", "bir iki üç", dil="tr",
                              degerlendirme=False)
        self.assertEqual(rapor["eksik"], ["üç"])

    def test_rapor_json_serilestirilebilir(self):
        rapor = akis.metinden("bir iki", "bir iki üç", dil="tr",
                              degerlendirme=False)
        json.dumps(rapor, ensure_ascii=False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
