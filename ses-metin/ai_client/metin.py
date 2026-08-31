# -*- coding: utf-8 -*-
"""Metin üreten model istemcisi (değerlendirme cümlesi için).

Uygulama kodu yalnızca şunu bilir:

    istemci = ai_client.metin_istemcisi(ayar)
    cumle = istemci.uret(istem, sistem="...")

Hangi modelin, hangi adreste çalıştığı ayarlar.toml'un işi.

Neden `SablonMetin` var: değerlendirme cümlesi boru hattının en az kritik
parçası. Uyuşma yüzdesi ve kelime farkları matematikle çıkar, LLM yalnızca
sonucu cümleye döker. Ollama kurulu değilse ya da yaşlı makine yorulduysa
uygulamanın tamamen durması yerine cümlenin sadeleşmesi çok daha iyidir.
"""
import json
import urllib.error
import urllib.request


class MetinHatasi(RuntimeError):
    pass


class MetinIstemcisi:
    def uret(self, istem, sistem=None):
        raise NotImplementedError

    def hazir_mi(self):
        raise NotImplementedError


class OllamaMetin(MetinIstemcisi):
    """Ollama'nın /api/generate ucuna konuşur."""

    def __init__(self, adres, model, bellekte_tut="0s", zaman_asimi=120,
                 sicaklik=0.2, azami_belirtec=120):
        self.adres = adres.rstrip("/")
        self.model = model
        self.bellekte_tut = bellekte_tut
        self.zaman_asimi = zaman_asimi
        self.sicaklik = sicaklik
        self.azami_belirtec = azami_belirtec

    def uret(self, istem, sistem=None):
        govde = {
            "model": self.model,
            "prompt": istem,
            "stream": False,
            # Yaşlı makine için kritik: iş bitince modeli bellekten at.
            # Ollama'nın varsayılanı 5 dakika tutmaktır; o süre boyunca
            # ~2 GB RAM boşuna dolu kalır.
            "keep_alive": self.bellekte_tut,
            "options": {
                "temperature": self.sicaklik,
                "num_predict": self.azami_belirtec,
            },
        }
        if sistem:
            govde["system"] = sistem
        istek = urllib.request.Request(
            self.adres + "/api/generate",
            data=json.dumps(govde).encode("utf-8"),
            headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(istek, timeout=self.zaman_asimi) as y:
                veri = json.loads(y.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detay = ""
            try:
                detay = e.read().decode("utf-8")[:200]
            except Exception:
                pass
            raise MetinHatasi("Ollama hata döndü (%s): %s" % (e.code, detay))
        except urllib.error.URLError as e:
            raise MetinHatasi(
                "Ollama'ya ulaşılamadı (%s): %s — servis çalışıyor mu? "
                "`ollama serve`" % (self.adres, e))
        except Exception as e:
            raise MetinHatasi("Ollama yanıtı okunamadı: %s" % e)
        return (veri.get("response") or "").strip()

    def hazir_mi(self):
        """Servis ayakta mı ve ayardaki model inmiş mi?"""
        try:
            with urllib.request.urlopen(self.adres + "/api/tags", timeout=5) as y:
                veri = json.loads(y.read().decode("utf-8"))
        except Exception:
            return False
        adlar = [m.get("name", "") for m in veri.get("models", [])]
        # "qwen2.5:3b" ile "qwen2.5:3b-instruct-q4_K_M" aynı model ailesi;
        # kullanıcı etiketi kısa yazmış olabilir.
        kok = self.model.split(":")[0]
        return any(a == self.model or a.split(":")[0] == kok for a in adlar)


class SablonMetin(MetinIstemcisi):
    """Model kullanmaz. İstemin sonuna gömülen sayıları cümleye döker.

    Gerçek bir yedek olabilmesi için istemi ayrıştırmaya çalışmaz; bunun
    yerine `degerlendir` modülü ona hazır bir özet sözlüğü geçer.
    """

    def uret(self, istem, sistem=None):
        return ""          # akış bunu görünce şablon cümleye düşer

    def hazir_mi(self):
        return True
