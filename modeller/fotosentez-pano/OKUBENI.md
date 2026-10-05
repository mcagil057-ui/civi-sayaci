# Fotosentez Panosu — ders kitabı şemasının 3D hâli

Pano **280 × 220 mm**, 300 × 300 tablaya rahat sığar.
Parçalar panodaki **kendi biçimindeki oyuklara** oturur: her malzemenin
tek bir yeri var, oraya tam girer, elle çıkar.

## ÖNCE BUNU OKU — hangi dosyayı açacaksın

Klasörde üç tür dosya var. **Hepsini birden açma**: her STL kendi merkezine
hizalıdır, aynı sahneye atılınca hepsi aynı noktaya gelir ve üst üste görünür.

| Ne yapacaksın | Hangi dosya |
|---|---|
| **Nasıl göründüğüne bakmak** | `00-MONTAJ-sadece-goruntuleme.stl` — tek dosya, her şey takılı. Basmak için değil. |
| **Basmak** | `baski-1-pano.stl` · `baski-2-parcalar.stl` · `baski-3-renkli-oklar.stl` — üçünü ayrı ayrı dilimle. |
| **Tek tek renkli basmak** | `parca-*.stl`, `renkli-ok-*.stl` — her seferinde bir dosya. |

## Oyuklar nasıl çalışıyor

- Oyuk derinliği **2,5 mm**, parça kalınlığı **5,3 mm** → parça 2,8 mm dışarıda
  kalır, parmakla rahat çıkar.
- Oyuk ile parça arasında her kenarda **0,4 mm** pay var. Sıkı olursa zımpara;
  gevşek olursa `assets/fotosentez-pano.js` içindeki `bosluk: 0.4` değerini
  0,25 yapıp yeniden üret.
- Granum ve Kalvin dahil 12 parçanın hepsinin kendi oyuğu var.

## Yazılar siyah nasıl olur

Yazılar **1 mm kabartma**. Baskı bitince siyah keçeli kalemi panonun üstünden
düz sür: boya sadece harflerin üst yüzüne değer. Taşarsa ıslak mendille sil.

## Oklar renkli nasıl olur

Panoda oklar 3,5 mm kabartma olarak zaten var. İstersen `renkli-ok-*.stl`
dosyalarını ayrı renkte basıp kabartmanın üstüne yapıştır — birebir oturur.

| Dosya | Kitaptaki rengi |
|---|---|
| `renkli-ok-h2o`, `renkli-ok-o2` | mor/mavi |
| `renkli-ok-co2`, `renkli-ok-glikoz` | koyu yeşil |
| `renkli-ok-isik` (3 ok tek parça) | turuncu |
| `renkli-ok-dongu` (4 ok tek parça) | siyah/gri |

## Parça listesi

| Dosya | Parça | Ölçü (mm) |
|---|---|---|
| `pano-zemin.stl` | Pano, 12 oyuk | 280 × 220 × 9,5 |
| `parca-granum.stl` | Granum — 7 tilakoit, üzerinde yazı yok | 32 × 32 × 38 |
| `parca-kalvin.stl` | Kalvin döngüsü, içinde `IŞIĞIN KULLANILMADIĞI TEPKİMELER` | 64 × 68 × 6 |
| `parca-isik.stl` | Işık (güneş) | 34 × 34 × 5 |
| `parca-su.stl` | H₂O | 27 × 17 × 5 |
| `parca-karbondioksit.stl` | CO₂ | 27 × 17 × 5 |
| `parca-oksijen.stl` | O₂ | 20 × 17 × 5 |
| `parca-glikoz.stl` | C₆H₁₂O₆ | 43 × 16 × 5 |
| `parca-atp.stl` | ATP | 32 × 34 × 5 |
| `parca-adp.stl` | ADP | 31 × 32 × 5 |
| `parca-fosfat.stl` | P | 16 × 16 × 5 |
| `parca-nadph.stl` | NADPH | 38 × 16 × 5 |
| `parca-nadp-arti.stl` | NADP⁺ | 36 × 16 × 5 |

Toplam ≈ 132 g filament. Pano ~5 saat, parçalar ~2 saat, oklar ~1 saat.

## Baskı ayarları

PLA · katman **0,2 mm** · dolgu %12 · duvar 3 hat · **destek gerekmez**.
0,3 mm katman kullanma, yazılar okunmaz.

### Renk önerisi
pano beyaz · granum yeşil · Kalvin mavi · ATP ve P sarı · ADP açık yeşil ·
NADPH ve NADP⁺ beyaz · H₂O ve CO₂ mavi · O₂ ve glikoz kırmızı · güneş sarı

## Denetim

- `node tools/yerlesim-denetle.mjs` → üstten görünüşte çakışma ölçer
  ("Çakışma yok ✓" demeli)
- `node tools/yer-ara.mjs STROMA --ic` → bir yazı için çakışmasız konum arar
- Bütün STL'ler kapalı yüzey (manifold) olarak doğrulandı

## Anlatım sırası

1. Boş panoyu göster: çift zar, stroma, oyuklar.
2. **Granum** → "ışığa bağımlı tepkimeler burada."
3. **Işık** + **H₂O** → "su parçalanır."
4. **O₂** → "açığa çıkar."
5. **ATP** + **NADPH** → "granumda üretilir, stromaya taşınır."
6. **Kalvin döngüsü** → "ışık gerekmez."
7. **CO₂** → "karbon buraya girer."
8. **C₆H₁₂O₆** → "ürün budur."
9. **ADP** + **P** → "enerji boşalır, granuma döner; döngü kapanır."
