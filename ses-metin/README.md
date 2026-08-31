# Ses–Metin Uyuşma Kontrolü

Bir ses kaydı ile bir referans metin verilir; sistem sesi metne çevirir,
referansla karşılaştırır ve uyuşma yüzdesi, eksik/fazla/yanlış kelimeler ve
kısa bir değerlendirme cümlesi döndürür.

**Hiçbir ücretli servis kullanılmaz.** API çağrısı yoktur, kodda API anahtarı
yoktur. Her şey makinenin kendisinde çalışır; kullanılan araçların tamamı açık
kaynaktır.

Türkçe ve Arapça desteklenir. Arapça normalizasyon kuralları depodaki
`tilavet/` motoruyla birebir aynıdır (bkz. *Karşılaştırma nasıl çalışıyor*).

---

## Hızlı başlangıç

```bash
cd ses-metin

# Linux / macOS
./kurulum.sh

# Windows (PowerShell)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\kurulum.ps1
```

Kurulum betiği donanımı ölçer, RAM'e göre model boyutunu seçer ve **her büyük
indirmeden önce boyutu söyleyip onay ister**. Onaysız geçmek için
`./kurulum.sh --onayla`.

Sonra:

```bash
.venv/bin/python calistir.py --ses ornek/ornek-tr.wav --metin ornek/ornek-tr.txt
```

Bir şey çalışmazsa hangi parçanın eksik olduğunu söyler:

```bash
.venv/bin/python dogrula.py
```

---

## Kullanım

```bash
# ses dosyası + referans metin dosyası
python calistir.py --ses kayit.m4a --metin referans.txt

# referans metni doğrudan
python calistir.py --ses kayit.m4a --metin-satiri "bugün hava çok güzel"

# Arapça
python calistir.py --ses tilavet.mp3 --metin ayet.txt --dil ar

# ses adımını atla (model gerekmez; elde hazır çözüm metni varken)
python calistir.py --soylenen "bugün hava güzel" --metin-satiri "bugün hava çok güzel"

# makine tarafından okunacak çıktı
python calistir.py --ses kayit.m4a --metin referans.txt --json > sonuc.json

# yerel LLM'i hiç çağırma (şablon cümle kullan — daha hızlı, daha az RAM)
python calistir.py --ses kayit.m4a --metin referans.txt --degerlendirme-yok
```

Örnek çıktı:

```
==============================================================
  UYUŞMA:  %62.5
==============================================================
  referans kelime    : 8
  doğru              : 5
  yanlış             : 1
  atlanan            : 2

  Atlanan kelimeler : akşam, ve
  Yanlış okunanlar  : çok → gerçekten

Okuma dökümü   ( ~yakın  !yanlış  -atlanan  +fazladan )
--------------------------------------------------------------
  dün -akşam sinemaya gittik -ve film !çok→gerçekten güzeldi
```

Python'dan:

```python
from sesmetin import akis
rapor = akis.calistir("kayit.m4a", "referans metin", dil="tr")
print(rapor["uyusma"], rapor["eksik"], rapor["degerlendirme"])
```

---

## Mimari: `ai_client` katmanı

Uygulama kodunun hiçbir yerinde model adı, adres ya da port geçmez. Bütün
model çağrıları `ai_client` paketinden geçer, o da ayarını `ayarlar.toml`'dan
alır.

```
calistir.py / sunucu.py          ← arayüzler
        │
   sesmetin/                     ← uygulama mantığı (model bilmez)
     akis.py  karsilastir.py  normalize.py  degerlendir.py
        │
   ai_client/                    ← TEK model geçiş noktası
     ayar.py   ses.py   metin.py
        │
   ayarlar.toml                  ← model adı, adres, port
```

`ai_client` uygulamadan bağımsızdır: içinde karşılaştırma ya da raporlama
mantığı yoktur, bu yüzden başka uygulamalar da olduğu gibi kullanabilir.

```python
from ai_client import Ayar, ses_istemcisi, metin_istemcisi
ayar = Ayar.yukle()
cozum = ses_istemcisi(ayar).cevir("kayit.m4a", dil="tr")
cumle = metin_istemcisi(ayar).uret("...")
```

### Bir modülü başka makineye taşımak

Whisper'ı güçlü bir makinede çalıştırmak istersen, **yalnızca adres değişir**.

Güçlü makinede:

```bash
python3 sunucu.py --port 8020
```

Zayıf makinede `ayarlar.toml`:

```toml
[ses]
saglayici = "uzak"
adres     = "http://192.168.1.20:8020"
```

Uygulama kodunda tek satır değişmez. Aynısı LLM için de geçerli:
`[metin].adres` satırını başka makinedeki Ollama'ya çevirmek yeterli.

> `sunucu.py`'de kimlik doğrulama yoktur. Yalnızca güvendiğin yerel ağda
> çalıştır, açık internete koyma.

### Ayarlar

Hepsi `ayarlar.toml`'da. Ortam değişkeniyle de geçilebilir:

```bash
SESMETIN_SES_MODEL=base SESMETIN_METIN_SAGLAYICI=sablon python calistir.py ...
```

Öncelik: ortam değişkeni > `ayarlar.toml` > koddaki varsayılan.

| Ayar | Değerler | Ne işe yarar |
|---|---|---|
| `[ses].saglayici` | `yerel` / `uzak` / `dosya` | Whisper nerede çalışsın |
| `[ses].model` | `tiny`…`large-v3` | Whisper boyutu |
| `[ses].hesap_tipi` | `int8`, `float16`, `float32` | Niceleme; `int8` en az RAM |
| `[ses].is_parcacigi` | sayı, `0`=otomatik | Makine zorlanıyorsa `2` yap |
| `[metin].saglayici` | `ollama` / `sablon` | LLM kullanılsın mı |
| `[metin].bellekte_tut` | `0s`, `5m` | İş bitince model bellekten atılsın mı |

`dosya` sağlayıcısı gerçek tanıma yapmaz: ses dosyasının yanındaki `.txt`
dosyasını okur. Test için ve elde hazır çözüm metni olanlar için.

---

## Karşılaştırma nasıl çalışıyor

**Normalizasyon.** Noktalama ve büyük/küçük harf farkı yok sayılır. Bunun
ötesinde her dilin kendi tuzağı ele alınır:

- *Türkçe:* `.lower()` Türkçede yanlış çalıştığı için (`I`→`ı`, `İ`→`i`) elle
  eşlenir. Şapkalı harfler düzleşir (`kâğıt`=`kağıt`), kesme işareti düşer
  (`Ankara'da`=`Ankarada`), rakamlar yazıya çevrilir (`5`=`beş`). Sonuncusu
  önemli: Whisper bazen rakam bazen yazı üretir, bu olmadan kullanıcı doğru
  okuduğu halde sistem onu yanlışlar.
- *Arapça:* hareke, tecvid işaretleri ve tatvil atılır; yazım varyantları
  tekleştirilir. Kurallar `tools/veri-uret.py` ve `tilavet/engine.js` ile
  **birebir aynıdır** ve bunu bir test bağlar
  (`testler/test_normalize.py::test_depodaki_kurallarla_birebir_ayni`).
  İkisi ayrışırsa ekrandaki metinle eşleştirme metni birbirini tutmaz.

**Hizalama.** Kelimeler yan yana değil, hizalanarak karşılaştırılır. Sebep:
kullanıcı tek bir kelimeyi atlarsa sonraki bütün kelimeler bir sıra kayar ve
naif karşılaştırmada hepsi yanlış görünür. Hizalama sayesinde bir atlama tek
bir "eksik" olarak raporlanır.

Üç yol vardır, üçü de aynı sonucu verir (testle bağlı):

| Yol | Ne zaman | Maliyet |
|---|---|---|
| tam matris | kısa metin (< ~200×200 kelime) | en doğru, en yavaş |
| çapa bölme | uzun metin | iki metinde de tek geçen ortak kelimelerden bölünür |
| bant | uzun **ve** kendini tekrar eden metin | köşegen çevresi |

Ölçüm: 20.000 kelime **0,16 saniye** (bu geliştirme makinesinde).

**Sonuç türleri.** `dogru`, `yakin` (eşik üstü benzer — Osmanî/modern imlâ
farkı gibi), `yanlis`, `eksik`, `fazla`. `yakin` bilerek ayrı tutulur: sistem
"bunu doğru saydım" dediği yerleri göstermeli, sessizce yutmamalı.

Uyuşma yüzdesi = `1 − (yanlış + eksik + fazla) / referans kelime sayısı`,
0'ın altına inmez.

**Değerlendirme cümlesi.** Yerel LLM'e yalnızca hazır sayılar verilir ve
yorum değil, cümleye dökme istenir. Model erişilemezse ya da boş dönerse
şablona düşülür — uygulama durmaz, cümle sadeleşir. Çıktı hangisinin
kullanıldığını söyler (`degerlendirme_kaynagi`).

---

## Donanım ve model seçimi

| RAM | Whisper | LLM | Not |
|---|---|---|---|
| 4 GB | `base` | `qwen2.5:1.5b` | Sıkışık; modüller sırayla çalışır |
| **8 GB** | **`small`** | **`qwen2.5:3b`** | **Hedeflenen yapılandırma** |
| 16 GB+ | `small`/`medium` | `qwen2.5:3b` veya 7b | Rahat |

**Neden Whisper `small`:** Bu araç "söylenen metin referansa uyuyor mu" diye
bakıyor. Whisper bir kelimeyi yanlış duyarsa, karşılaştırma bunu kullanıcının
hatası sanıp "yanlış söyledin" der — yani transkripsiyon hatası doğrudan
yalancı hata raporuna dönüşür. Türkçe, Whisper'ın en iyi bildiği diller
arasında değil; `tiny` ve `base` belirgin tökezliyor. `small` kalitenin
kabul edilebilir hale geldiği ilk basamak. `faster-whisper` (CTranslate2)
motoru sayesinde `int8` ile `small`, vanilya `whisper`'ın `base`'i kadar yük
bindirir.

**Neden `qwen2.5`:** Değerlendirme cümlesi küçük bir iş; 3B fazlasıyla yeter.
Qwen2.5, aynı boyuttaki Llama 3.2 ve Gemma 2'ye göre Türkçeyi belirgin daha
az bozuyor. `q4_K_M` niceleme boyutu ~1.9 GB'a indiriyor.

**Bellek:** Whisper ve LLM aynı anda yüklenmez. `[metin].bellekte_tut = "0s"`
sayesinde Ollama işi bitince modeli hemen bırakır (varsayılanı 5 dakika
tutmaktır). Tepe RAM kullanımı ~2,5–3 GB'da kalır.

**Toplam indirme:** ~4,5 GB (ffmpeg 100 MB + python paketleri 500 MB +
Whisper small 500 MB + Ollama 1,5 GB + LLM 1,9 GB). Diskte en az 8–10 GB boş
alan olmalı.

---

## Testler

```bash
./test-et.sh
```

46 test; model, ağ ya da ses dosyası gerektirmez — saf Python mantığını
sınarlar. Kapsam: iki dilin normalizasyonu, depo kurallarıyla eşitlik,
hizalamanın üç yolunun birbiriyle tutarlılığı, sınır durumları, ayar
öncelikleri, sağlayıcı seçimi, sahte Ollama ile LLM yolu ve şablona düşme.

---

## Bilinen sınırlar

- `ornek/ornek-tr.wav` **espeak-ng ile üretilmiş robotik sentezdir**; kurulumun
  ayakta olduğunu görmeye yarar. Whisper'ın gerçek doğruluğunu ölçmek için
  kendi sesinle kaydedilmiş bir dosya kullan.
- Türkçe eşik `0.82`, Arapça `0.85` olarak seçildi
  (`sesmetin/karsilastir.py::VARSAYILAN_ESIK`). Bunlar gerçek kayıtlarla
  ayarlanması gereken sayılar; `yakin` listesine bakıp kendi verinde tut.
- Arapça tarafı Kur'an tilaveti için tasarlanan `tilavet/` motorunun
  normalizasyonunu paylaşır, ama Whisper'ın tecvidli okumadaki başarımı
  Türkçedekinden farklıdır ve ölçülmemiştir. `small` yetmezse `medium`
  denenmeli.
- `sunucu.py` kimlik doğrulaması yapmaz.
