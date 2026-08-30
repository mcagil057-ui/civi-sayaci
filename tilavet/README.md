# Tilavet

Kur'an-ı Kerim'i oku, dinle ve ezberle. Okurken mikrofonu açarsan uygulama
nerede olduğunu bulur, okuduğun kelimeyi canlı olarak işaretler ve
atladığın ya da yanlış okuduğun yerleri gösterir.

Sunucu yoktur: metin statik dosyalardan gelir, ses tanıma tarayıcıda çalışır,
ilerleme yalnız cihazda saklanır. GitHub Pages'te olduğu gibi çalışır.

## Kapsam

Okuyucu, kâri sesi ve mikrofon takibi tek bir kavram üzerinden çalışır:
**kapsam**. Bir kapsam ya bir sûre, ya bir mushaf sayfası, ya da seçilmiş bir
ayet aralığıdır. Üçü de aynı kod yolunu kullanır; "sayfayı ezberle" ile "şu üç
ayeti beş kez tekrar et" ayrı birer özellik olmak zorunda kalmaz. Aralık,
sûre+ayet yerine genel ayet sırasıyla tutulur, böylece iki sûreye taşan bir
sayfadan da aralık seçilebilir.

İki okuma düzeni vardır: **ayet ayet** (meal ve araçlarla) ve **mushaf**
(sürekli, iki yana yaslı hat, ayet madalyonları, sûre ayraçları, sayfa
altlığı). Sayfa sınırları basılı mushafla birebir aynıdır — 604 sayfa — ama
**satır kırılımları aynı değildir**: satır düzeyinde mushaf düzeni verisi
çevrimdışı erişilebilir bir kaynakta bulunmuyor.

## Nasıl çalışır

Zor olan kısım ses tanıma değil, **tanınanı metne oturtmak**. Boru hattı:

1. **Ses → kelime.** Tarayıcının Web Speech API'si Arapça konuşmayı kelimelere
   çevirir; ara sonuçlar büyüyerek geldiği için yalnız yeni eklenen kelimeler
   motora verilir.
2. **Normalizasyon.** Hem tanıyıcı çıktısı hem mushaf metni ortak bir forma
   indirgenir: harekeler, tecvid işaretleri ve tatvil atılır; hemze, elif ve
   ta-marbuta varyantları tekleştirilir. Osmanî hattaki küçük (üstteki) harfler
   telaffuz edildikleri için silinmez, tam harfe çevrilir.
3. **Kelime benzerliği.** Osmanî imlâ ile modern imlâ arasındaki farkın
   neredeyse tamamı eliften gelir (`العالمين`/`العلمين`, `ذالك`/`ذلك`). Elif
   atılıp yinelenen harfler tekleştirilerek elde edilen *iskelet* iki yazımı
   aynı forma indirir. Tutmazsa düzenme mesafesine bakılır.
4. **Konum bulma.** Tüm Kur'an'ın üçlü kelime dizileri iskelet üzerinden
   dizinlenir. Söylenen her üçlü, "bu okuma şu konumda başlamış olmalı" diye
   bir oy verir; en çok oy alan başlangıç kazanır. Adaylar sonra serbest
   hizalamayla yeniden puanlanır.
5. **Takip.** İmleç beklenen kelimede durur; gelen kelime imlecin çevresindeki
   dar bir pencerede aranır. İleride bulunursa aradakiler atlanmış, geride
   bulunursa tekrar edilmiş demektir. Geriye eşleşmek ileriye eşleşmekten
   pahalıdır, yoksa metinde iki kez geçen bir kelime tek atlamayı iki hata
   olarak yazdırır.
6. **Hata sınıflandırma.** Bulgular anında yazılmaz. Ses tanıma bir kelimeyi
   yuttuğunda kullanıcıya haksız yere "atladın" demek bu tür uygulamaların en
   can sıkıcı hatasıdır; bu yüzden bulgular beklemeye alınır ve ancak
   arkasından gelen kelimeler aynı konumu doğrularsa kesinleşir. İmleç tamamen
   kaybolduğunda (müteşabih bir ayete geçildiğinde) konum baştan aranır.

## Dosyalar

| | |
|---|---|
| `index.html` | arayüz ve biçemler |
| `app.js` | ekranlar, ses, mikrofon akışı, ilerleme |
| `engine.js` | normalizasyon, dizin, hizalama, hata sınıflandırma, tekrar planı — DOM'dan bağımsız |
| `data/meta.json` | 114 sûre, 30 cüz, 604 sayfa, secde ayetleri |
| `data/text/NNN.json` | sûre başına Osmanî hat, meal, Latin okunuş |
| `data/match.json` | 6236 ayetin eşleştirme metni (77.433 kelime) |
| `sw.js` | çevrimdışı önbellek |
| `test/engine.test.js` | motor testleri (gerçek Kur'an verisiyle) |
| `test/arayuz.test.js` | arayüz testleri (gerçek tarayıcıda, sahte mikrofonla) |

Testler:

```sh
node tilavet/test/engine.test.js

npm i playwright-core
python3 -m http.server 8765 &        # deponun kökünde
CHROME=/yol/chrome node tilavet/test/arayuz.test.js
```

Veri paketi `tools/veri-uret.py` ile üretilir.

## Bilinmesi gerekenler

- **Ses tanıma tarayıcının hizmetidir**, internet ister ve Kur'an tilaveti için
  eğitilmemiştir; tecvidli, ağır tempolu okumada yanılabilir. Uygulama bunu
  hata eşikleriyle telafi eder ama kusursuz değildir. Chrome ve Edge destekler;
  Firefox desteklemez.
- **Metin ve meal çevrimdışı çalışır**, kâri sesi çalışmaz (everyayah.com'dan
  akar). Tekrar sayısı yalnız sesli dinlemede geçerlidir.
- **Mushaf düzeni sayfa doğru, satır değil** (yukarıya bakınız).
- İlerleme, ezber planı ve yer imleri yalnız tarayıcının deposunda durur;
  hiçbir yere gönderilmez.

## Kaynaklar

- Metin: Kral Fahd Kur'an Basım Kompleksi, Osmanî Hafs
- Meal: Diyanet Vakfı · Latin okunuş: fawazahmed0/quran-api
- Hat: [Amiri Quran](https://github.com/alif-type/amiri) (SIL OFL 1.1)
- Ses: everyayah.com
