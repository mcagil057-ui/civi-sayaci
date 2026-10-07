# Fotosentez Panosu — 25 ayrı STL

Her parça **kendi dosyasında**. Dilimleyicide tek tek aç, tablaya kaç tane
sığıyorsa o kadarını koy, bas. Birleştirilmiş dosya yok.

Pano 290 × 240 mm, dış kenarında 1 cm çerçeve. 300 × 300 tablaya sığar.

---

## Baskı sırası (önerilen 4 oturum)

**1. oturum — pano** (tek başına, ~6 saat)
`pano-zemin.stl` · 290 × 240 × 16 mm

**2. oturum — kloroplast zarı** (tek başına, ~2 saat)
`parca-kloroplast-zari.stl` · 250 × 170 × 8 mm — **brim kullan**, uzun ve ince

**3. oturum — yapılar ve moleküller** (hepsi birlikte sığar, ~2 saat)

| Dosya | Ölçü (mm) |
|---|---|
| `parca-granum.stl` | 32 × 32 × 38 |
| `parca-kalvin.stl` | 58 × 62 × 7 |
| `parca-isik.stl` | 34 × 34 × 5 |
| `parca-su.stl` | 27 × 17 × 5 |
| `parca-karbondioksit.stl` | 27 × 17 × 5 |
| `parca-oksijen.stl` | 20 × 17 × 5 |
| `parca-glikoz.stl` | 43 × 16 × 5 |
| `parca-atp.stl` | 29 × 31 × 5 |
| `parca-adp.stl` | 28 × 30 × 5 |
| `parca-fosfat.stl` | 16 × 16 × 5 |
| `parca-nadph.stl` | 30 × 13 × 5 |
| `parca-nadp-arti.stl` | 29 × 13 × 5 |

**4. oturum — oklar** (hepsi birlikte sığar, ~1 saat)

| Dosya | Ne | Ölçü (mm) |
|---|---|---|
| `parca-ok-h2o.stl` | H₂O girer | 13 × 10 × 5 |
| `parca-ok-co2.stl` | CO₂ girer | 13 × 19 × 5 |
| `parca-ok-o2.stl` | O₂ çıkar | 13 × 16 × 5 |
| `parca-ok-glikoz.stl` | Glikoz çıkar | 13 × 15 × 5 |
| `parca-ok-isik-1/2/3.stl` | Işık ışınları | 12 × 11 × 5 |
| `parca-ok-granum-atp.stl` | Granum → ATP | 25 × 20 × 5 |
| `parca-ok-atp-kalvin.stl` | ATP → Kalvin | 41 × 23 × 5 |
| `parca-ok-kalvin-nadp.stl` | Kalvin → NADP⁺ | 22 × 11 × 5 |
| `parca-ok-adp-granum.stl` | ADP+P → granum | 25 × 34 × 5 |

**Sadece bakmak için:** `00-MONTAJ-sadece-goruntuleme.stl` — her şey takılı hâlde.
Bu dosyayı BASMA.

Toplam ≈ 170 g filament.

---

## Baskı ayarları

PLA · katman **0,2 mm** · dolgu %12 (oklar %100) · duvar 3 hat · **destek gerekmez**.
0,3 mm katman kullanma, yazılar okunmaz.

### Renk önerisi
pano beyaz · zar açık mavi · granum yeşil · Kalvin mavi · ATP ve P sarı ·
ADP açık yeşil · NADPH ve NADP⁺ beyaz · H₂O ve CO₂ mavi · O₂ ve glikoz kırmızı ·
güneş sarı · giriş okları mavi · çıkış okları koyu yeşil · döngü okları siyah

### Yazıları siyah yapmak
Yazılar 1 mm kabartma. Baskı bitince siyah keçeli kalemi panonun üstünden düz
sür — boya sadece harflerin üst yüzüne değer. Taşarsa ıslak mendille sil.

---

## Parçalar nasıl oturuyor

- Panoda **27 oyuk** var: 24 parça + kloroplast zarının 4 pimi için.
- Oyuk derinliği **3,5 mm**, parça kalınlığı **5,3 mm** → 1,8 mm dışarıda kalır.
- Her kenarda **0,4 mm** pay. Sıkı gelirse zımpara; gevşek gelirse
  `assets/fotosentez-pano.js` içindeki `bosluk: 0.4` değerini 0,3 yapıp
  `node tools/fotosentez-pano-uret.mjs` ile yeniden üret.
- Kloroplast zarı pano yüzeyine oturur, dört pimi oyuklara girer.

---

## Denetim

`DENETIM-RAPORU.txt` dosyasında dört bölümlük tam denetim var — **258 kontrol,
0 hata.** Her biri ayrı komutla yeniden alınabilir:

| Komut | Ne yapar |
|---|---|
| `node tools/dosya-denetim.mjs` | Teslim edilen STL'leri **diskten okur**: kapalı yüzey mi, tablaya sığıyor mu, eksik/fazla dosya var mı |
| `node tools/fiziksel-denetim.mjs` | Panoya **ışın atıp** her oyuğun gerçek açıklığını ölçer, parçayı içine indirmeyi dener |
| `node tools/denetim.mjs` | Oyuk payı, zar ilişkisi, çerçeve sınırı, yazı taşması, pim hizası, katı doğrulama |
| `node tools/yerlesim-denetle.mjs` | Üstten görünüşte parça/ok/yazı çakışması |

---

## Anlatım sırası

1. **Kloroplast zarı** → "fotosentez burada olur, çift zarlı."
2. **Granum** → "ışığa bağımlı tepkimeler burada."
3. **Işık** + 3 ışık oku + **H₂O** → "su parçalanır."
4. **O₂** + oku → "açığa çıkar."
5. **ATP** + **NADPH** + granum→ATP ve ATP→Kalvin okları → "enerji stromaya taşınır."
6. **Kalvin döngüsü** → "ışık gerekmez."
7. **CO₂** + oku → "karbon buraya girer."
8. **C₆H₁₂O₆** + oku → "ürün budur."
9. **ADP** + **P** + dönüş okları → "enerji boşalır, döngü kapanır."
