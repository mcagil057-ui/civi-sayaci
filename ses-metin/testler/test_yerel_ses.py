# -*- coding: utf-8 -*-
"""YerelSes testleri.

Whisper ağırlıkları olmadan da bizim kodumuz sınanabilmeli: modelin yerine
sahte bir nesne koyup `cevir()` mantığını doğruluyoruz — parçaların
tüketilmesi, metnin birleştirilmesi, dil ve sürenin taşınması, hataların
SesHatasi'na sarılması.

API imzalarının gerçek faster-whisper ile uyuştuğu ayrıca sınanır
(test_faster_whisper_imzalari); sahte nesne gerçeğinden sapmasın diye.
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_client.ses import Cozum, SesHatasi, YerelSes


class SahteParca:
    def __init__(self, start, end, text):
        self.start, self.end, self.text = start, end, text


class SahteBilgi:
    def __init__(self, language="tr", duration=3.5):
        self.language, self.duration = language, duration


class SahteModel:
    """faster-whisper'ın WhisperModel'i yerine geçer."""

    def __init__(self, parcalar=None, bilgi=None, hata=None):
        self.parcalar = parcalar or []
        self.bilgi = bilgi or SahteBilgi()
        self.hata = hata
        self.son_cagri = None

    def transcribe(self, ses_yolu, **kwargs):
        self.son_cagri = dict(kwargs, ses_yolu=ses_yolu)
        if self.hata:
            raise self.hata
        # Gerçek kütüphane üretici döndürür; sahtesi de döndürmeli.
        return (p for p in self.parcalar), self.bilgi


class YerelSesTest(unittest.TestCase):
    def setUp(self):
        self.gecici = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        self.gecici.close()
        self.addCleanup(lambda: os.path.exists(self.gecici.name)
                        and os.unlink(self.gecici.name))

    def _istemci(self, model):
        istemci = YerelSes(model="small", hesap_tipi="int8")
        istemci._model = model          # yüklemeyi atla
        return istemci

    def test_parcalar_birlestirilir(self):
        model = SahteModel([SahteParca(0.0, 1.5, " Bugün hava"),
                            SahteParca(1.5, 3.2, " çok güzel.")])
        cozum = self._istemci(model).cevir(self.gecici.name)
        self.assertIsInstance(cozum, Cozum)
        self.assertEqual(cozum.metin, "Bugün hava çok güzel.")
        self.assertEqual(cozum.dil, "tr")
        self.assertEqual(cozum.sure, 3.5)
        self.assertEqual(len(cozum.parcalar), 2)
        self.assertEqual(cozum.parcalar[0],
                         {"bas": 0.0, "son": 1.5, "metin": "Bugün hava"})

    def test_bos_kayit(self):
        cozum = self._istemci(SahteModel([])).cevir(self.gecici.name)
        self.assertEqual(cozum.metin, "")
        self.assertEqual(cozum.parcalar, [])

    def test_dil_gecirilir(self):
        model = SahteModel([SahteParca(0, 1, "x")])
        self._istemci(model).cevir(self.gecici.name, dil="ar")
        self.assertEqual(model.son_cagri["language"], "ar")

    def test_ayardaki_dil_kullanilir(self):
        model = SahteModel([SahteParca(0, 1, "x")])
        istemci = YerelSes(model="small", dil="tr")
        istemci._model = model
        istemci.cevir(self.gecici.name)
        self.assertEqual(model.son_cagri["language"], "tr")

    def test_vad_acik(self):
        # Sessizlikleri atlamak yaşlı makinede zaman kazandırır; ayarın
        # gerçekten geçtiğini bağlıyoruz.
        model = SahteModel([SahteParca(0, 1, "x")])
        self._istemci(model).cevir(self.gecici.name)
        self.assertTrue(model.son_cagri["vad_filter"])

    def test_olmayan_dosya(self):
        with self.assertRaises(SesHatasi) as k:
            self._istemci(SahteModel()).cevir("/olmayan/kayit.wav")
        self.assertIn("bulunamadı", str(k.exception))

    def test_model_hatasi_sarilir(self):
        """Kütüphaneden gelen ham hata kullanıcıya sızmamalı."""
        model = SahteModel(hata=RuntimeError("ctranslate2 patladı"))
        with self.assertRaises(SesHatasi) as k:
            self._istemci(model).cevir(self.gecici.name)
        self.assertIn("ctranslate2 patladı", str(k.exception))

    def test_faster_whisper_yoksa_anlasilir_hata(self):
        istemci = YerelSes(model="small")
        gercek = sys.modules.pop("faster_whisper", None)
        sys.modules["faster_whisper"] = None      # ImportError tetikle
        try:
            with self.assertRaises(SesHatasi) as k:
                istemci.cevir(self.gecici.name)
            self.assertIn("kurulu değil", str(k.exception))
        finally:
            sys.modules.pop("faster_whisper", None)
            if gercek is not None:
                sys.modules["faster_whisper"] = gercek


class ImzaTest(unittest.TestCase):
    """Sahte model gerçeğinden sapmasın: kullandığımız her parametre ve
    alan, kurulu faster-whisper'da gerçekten var mı?"""

    def setUp(self):
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            self.skipTest("faster-whisper kurulu değil")

    def test_faster_whisper_imzalari(self):
        import inspect
        from faster_whisper import WhisperModel
        from faster_whisper.transcribe import Segment, TranscriptionInfo

        init = inspect.signature(WhisperModel.__init__).parameters
        for ad in ("device", "compute_type", "cpu_threads", "download_root"):
            self.assertIn(ad, init, "WhisperModel.__init__ artık %s almıyor" % ad)

        tr = inspect.signature(WhisperModel.transcribe).parameters
        for ad in ("language", "vad_filter", "beam_size"):
            self.assertIn(ad, tr, "transcribe() artık %s almıyor" % ad)

        def alanlar(sinif):
            return set(getattr(sinif, "_fields", None)
                       or sinif.__dataclass_fields__)
        self.assertLessEqual({"language", "duration"},
                             alanlar(TranscriptionInfo))
        self.assertLessEqual({"start", "end", "text"}, alanlar(Segment))


if __name__ == "__main__":
    unittest.main(verbosity=2)
