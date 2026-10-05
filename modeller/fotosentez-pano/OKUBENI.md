# Fotosentez Panosu — ders kitabı şemasının 3D hâli

Kitaptaki bilgi görselinin üç boyutlu karşılığı. Zemin bir pano; moleküller ve
yapılar **pimli parçalar** olarak soketlere takılıp çıkarılıyor.

> **Pano 210 × 165 mm.** Yazıcı tablan bundan küçükse bas**ma**, haber ver —
> küçültülmüş sürümünü üretirim.

Yeniden üretmek: `node tools/fotosentez-pano-uret.mjs`
Yerleşim denetimi: `node tools/yerlesim-denetle.mjs` → "Çakışma yok ✓" demeli

---

## Yazıları nasıl siyah yapacaksın

Bütün yazılar **1 mm kabartma**. Baskı bitince panonun üstünden **siyah keçeli
kalemi düz bir şekilde sür** — boya sadece harflerin üst yüzüne değer, zemine
bulaşmaz. Taşarsa ıslak mendille sil, kabartmanın üstü kalır.

Beyaz zemin + siyah yazı = kitaptaki görünüm. Aynısını okların üstüne de
uygulayabilirsin ama oklar için daha iyi bir yol var:

## Okları nasıl renkli yapacaksın

Panoda oklar 3,5 mm kabartma olarak zaten var. İstersen `renkli-ok-*.stl`
dosyalarını **ayrı renkte** basıp panodaki kabartmanın üstüne yapıştır —
şekiller birebir aynı, kendiliğinden oturur.

| Dosya | Nereye | Kitaptaki rengi |
|---|---|---|
| `renkli-ok-h2o.stl` | H₂O oku | mor/mavi |
| `renkli-ok-o2.stl` | O₂ oku | mor/mavi |
| `renkli-ok-co2.stl` | CO₂ oku | koyu yeşil |
| `renkli-ok-glikoz.stl` | glikoz oku | koyu yeşil |
| `renkli-ok-isik.stl` | üç ışık oku (tek parça) | turuncu |
| `renkli-ok-dongu.stl` | dört döngü oku (tek parça) | siyah/gri |

Yapıştırmazsan da pano eksik kalmaz; oklar kabartma olarak duruyor.

---

## Takılıp çıkarılan 12 parça

| Dosya | Parça | Ölçü (mm) |
|---|---|---|
| `pano-zemin.stl` | Pano, 12 soket | 210 × 165 × 8,5 |
| `parca-granum.stl` | Granum — 7 tilakoit (üzerinde yazı yok) | 32 × 32 × 34 |
| `parca-kalvin.stl` | Kalvin döngüsü, içinde `IŞIĞIN KULLANILMADIĞI TEPKİMELER` | 64 × 68 × 8 |
| `parca-isik.stl` | Işık (güneş) | 33 × 33 × 7 |
| `parca-su.stl` | H₂O | 24 × 15 × 7 |
| `parca-karbondioksit.stl` | CO₂ | 24 × 15 × 7 |
| `parca-oksijen.stl` | O₂ | 18 × 15 × 7 |
| `parca-glikoz.stl` | C₆H₁₂O₆ | 40 × 15 × 7 |
| `parca-atp.stl` | ATP | 29 × 31 × 7 |
| `parca-adp.stl` | ADP | 28 × 29 × 7 |
| `parca-fosfat.stl` | P (fosfat) | 14 × 14 × 7 |
| `parca-nadph.stl` | NADPH | 35 × 15 × 7 |
| `parca-nadp-arti.stl` | NADP⁺ | 34 × 15 × 7 |

Karoların boyu yazının genişliğinden hesaplanıyor; hiçbir yazı karodan taşmaz.

Toplam ≈ 73 g filament. Pano ~3 saat, parçalar toplu ~2 saat.

## Baskı ayarları

- PLA · katman **0,2 mm** · dolgu %15 · duvar 3 hat
- **Destek gerekmez.** Soketler delik değil, yükseltilmiş halka.
- 0,3 mm katman kullanma: yazılar okunmaz.

### Renk önerisi
pano beyaz · granum yeşil · Kalvin mavi · ATP sarı · ADP açık yeşil · P sarı ·
NADPH ve NADP⁺ beyaz · H₂O ve CO₂ mavi · O₂ ve glikoz kırmızı · güneş sarı

## Pim sıkılığı

Pim Ø8,0 mm, soket Ø8,7 mm. Gevşek durursa `assets/fotosentez-pano.js`
içindeki `bosluk: 0.35` değerini 0,25 yapıp yeniden üret.

## Kitaptan farklar

1. **Kontur** kitapta kubbemsi, burada elips.
2. **Döngü okları** kitapta ince ve kavisli; burada dört kalın düz ok —
   kavisli ve ince olanlar baskıda kopuyor.
3. Granumun üzerindeki `IŞIĞIN KULLANILDIĞI TEPKİMELER` ibaresi, isteğin
   üzerine kaldırıldı.

## Anlatım sırası

1. Boş panoyu göster: çift zar, stroma, granum yeri.
2. **Granum** → "ışığa bağımlı tepkimeler burada."
3. **Işık** + **H₂O** → "su parçalanır."
4. **O₂** → "açığa çıkar, atmosfere verilir."
5. **ATP** + **NADPH** → "granumda üretilir, stromaya taşınır."
6. **Kalvin döngüsü** → "ışık gerekmez."
7. **CO₂** → "karbon buraya girer."
8. **C₆H₁₂O₆** → "ürün budur."
9. **ADP** + **P** → "enerji boşalır, granuma döner; döngü kapanır."
