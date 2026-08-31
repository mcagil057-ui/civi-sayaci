# -*- coding: utf-8 -*-
"""Ses → metin istemcisi.

Uygulama kodu yalnızca şunu bilir:

    istemci = ai_client.ses_istemcisi(ayar)
    cozum = istemci.cevir("kayit.m4a", dil="tr")

Modelin bu makinede mi yoksa ağdaki başka bir makinede mi çalıştığı
uygulamayı ilgilendirmez; ayarlar.toml'daki `saglayici` satırı karar verir.
Whisper'ı başka bir makineye taşımak, orada sunucu.py'yi çalıştırıp burada
`saglayici = "uzak"` ve `adres` yazmaktan ibarettir.
"""
import json
import os
import urllib.error
import urllib.request


class SesHatasi(RuntimeError):
    """Ses çevirisi yapılamadı. Uygulama bunu kullanıcıya gösterebilir."""


class Cozum:
    """Bir ses dosyasının çözümü."""

    def __init__(self, metin, dil=None, sure=None, parcalar=None, model=None):
        self.metin = (metin or "").strip()
        self.dil = dil                  # modelin sezdiği ya da dayatılan dil
        self.sure = sure                # ses uzunluğu, saniye
        self.parcalar = parcalar or []  # [{"bas":.., "son":.., "metin":..}]
        self.model = model

    def sozluk(self):
        return {"metin": self.metin, "dil": self.dil, "sure": self.sure,
                "parcalar": self.parcalar, "model": self.model}

    def __repr__(self):
        return "Cozum(%r, dil=%r)" % (self.metin[:40], self.dil)


class SesIstemcisi:
    """Ortak arayüz. Yeni bir sağlayıcı eklemek bunu türetmekle olur."""

    def cevir(self, ses_yolu, dil=None):
        raise NotImplementedError

    def hazir_mi(self):
        """Servis/model erişilebilir mi? Kurulum kontrolü için."""
        raise NotImplementedError


# --- Bu makinede: faster-whisper -----------------------------------------
class YerelSes(SesIstemcisi):
    """faster-whisper'ı aynı süreçte çalıştırır.

    Model ilk `cevir` çağrısında yüklenir, bilerek: uygulama açılışında
    yüklemek yaşlı makinede ses dosyası gelmeden 1 GB RAM tutmak demek.
    """

    def __init__(self, model="small", hesap_tipi="int8", is_parcacigi=0,
                 dil="", model_dizini=""):
        self.model_adi = model
        self.hesap_tipi = hesap_tipi
        self.is_parcacigi = is_parcacigi or (os.cpu_count() or 1)
        self.dil = dil or None
        self.model_dizini = model_dizini or None
        self._model = None

    def _yukle(self):
        if self._model is not None:
            return self._model
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            raise SesHatasi(
                "faster-whisper kurulu değil. Kurulum: kurulum.sh çalıştırın "
                "ya da `pip install faster-whisper`.")
        try:
            self._model = WhisperModel(
                self.model_adi, device="cpu",
                compute_type=self.hesap_tipi,
                cpu_threads=self.is_parcacigi,
                download_root=self.model_dizini)
        except Exception as e:                       # indirme / bellek hatası
            raise SesHatasi("Whisper modeli yüklenemedi (%s): %s"
                            % (self.model_adi, e))
        return self._model

    def cevir(self, ses_yolu, dil=None):
        if not os.path.exists(ses_yolu):
            raise SesHatasi("Ses dosyası bulunamadı: %s" % ses_yolu)
        model = self._yukle()
        try:
            parcalar, bilgi = model.transcribe(
                ses_yolu,
                language=dil or self.dil,
                # Sessizlikleri atlamak yaşlı makinede gözle görülür zaman
                # kazandırır; boşluklarda model boşuna çalışmaz.
                vad_filter=True,
                beam_size=5)
            liste, butun = [], []
            for p in parcalar:                        # üretici: burada işler
                # Whisper parçaları baştaki boşlukla gelir (" Bugün hava");
                # ham haliyle birleştirilirse araya çift boşluk girer.
                metin = p.text.strip()
                liste.append({"bas": round(p.start, 2),
                              "son": round(p.end, 2),
                              "metin": metin})
                if metin:
                    butun.append(metin)
        except SesHatasi:
            raise
        except Exception as e:
            raise SesHatasi("Ses çevrilemedi: %s" % e)
        return Cozum(" ".join(butun), dil=getattr(bilgi, "language", None),
                     sure=getattr(bilgi, "duration", None), parcalar=liste,
                     model=self.model_adi)

    def hazir_mi(self):
        try:
            self._yukle()
            return True
        except SesHatasi:
            return False


# --- Başka makinede: sunucu.py -------------------------------------------
class UzakSes(SesIstemcisi):
    """Ses dosyasını ağdaki bir sunucu.py örneğine yollar."""

    def __init__(self, adres, model="small", dil="", zaman_asimi=600):
        self.adres = adres.rstrip("/")
        self.model_adi = model
        self.dil = dil or None
        self.zaman_asimi = zaman_asimi

    def cevir(self, ses_yolu, dil=None):
        if not os.path.exists(ses_yolu):
            raise SesHatasi("Ses dosyası bulunamadı: %s" % ses_yolu)
        with open(ses_yolu, "rb") as f:
            icerik = f.read()
        govde, tur = _coklu_parca(
            {"dil": dil or self.dil or ""},
            "ses", os.path.basename(ses_yolu), icerik)
        istek = urllib.request.Request(
            self.adres + "/cevir", data=govde,
            headers={"Content-Type": tur}, method="POST")
        try:
            with urllib.request.urlopen(istek, timeout=self.zaman_asimi) as y:
                veri = json.loads(y.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            # Sunucuya ULAŞILDI ama hata döndü. Gövdedeki açıklamayı
            # yutmamak önemli: kullanıcının göreceği tek ipucu odur.
            # (HTTPError, URLError'ın alt sınıfıdır; sırası bu yüzden önce.)
            mesaj = ""
            try:
                mesaj = (json.loads(e.read().decode("utf-8")).get("hata")
                         or "")
            except Exception:
                pass
            raise SesHatasi("Ses sunucusu hata döndü (%s): %s"
                            % (e.code, mesaj or e.reason))
        except urllib.error.URLError as e:
            raise SesHatasi("Ses sunucusuna ulaşılamadı (%s): %s — sunucu.py "
                            "çalışıyor mu?" % (self.adres, e.reason))
        except Exception as e:
            raise SesHatasi("Ses sunucusu yanıtı okunamadı: %s" % e)
        if veri.get("hata"):
            raise SesHatasi(veri["hata"])
        return Cozum(veri.get("metin", ""), dil=veri.get("dil"),
                     sure=veri.get("sure"), parcalar=veri.get("parcalar"),
                     model=veri.get("model", self.model_adi))

    def hazir_mi(self):
        try:
            with urllib.request.urlopen(self.adres + "/saglik", timeout=5) as y:
                return y.status == 200
        except Exception:
            return False


def _coklu_parca(alanlar, dosya_alani, dosya_adi, icerik):
    """multipart/form-data gövdesi kurar (requests bağımlılığı olmasın diye)."""
    sinir = "----sesmetin7f3a9c1e"
    ns = []
    for ad, deger in alanlar.items():
        ns.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n"
                   % (sinir, ad, deger)).encode("utf-8"))
    ns.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\n"
               "Content-Type: application/octet-stream\r\n\r\n"
               % (sinir, dosya_alani, dosya_adi)).encode("utf-8"))
    ns.append(icerik)
    ns.append(("\r\n--%s--\r\n" % sinir).encode("utf-8"))
    return b"".join(ns), "multipart/form-data; boundary=%s" % sinir


# --- Model olmadan: yanındaki metin dosyası ------------------------------
class DosyaSes(SesIstemcisi):
    """Ses yerine, ses dosyasının yanındaki .txt dosyasını okur.

    Model gerektirmediği için boru hattını uçtan uca sınamaya yarar; ayrıca
    elde hazır çözüm metni olan kullanıcı Whisper hiç kurmadan karşılaştırma
    yapabilir. Gerçek tanıma YAPMAZ — ayarda seçilmediği sürece devreye
    girmez.
    """

    def __init__(self, uzanti=".txt"):
        self.uzanti = uzanti

    def _metin_yolu(self, ses_yolu):
        return os.path.splitext(ses_yolu)[0] + self.uzanti

    def cevir(self, ses_yolu, dil=None):
        yol = self._metin_yolu(ses_yolu)
        if not os.path.exists(yol):
            raise SesHatasi(
                "Dosya sağlayıcısı %s dosyasını bekliyor; bulunamadı." % yol)
        with open(yol, encoding="utf-8") as f:
            return Cozum(f.read(), dil=dil, model="dosya")

    def hazir_mi(self):
        return True
