# Fotosentez Panosu — ders kitabı şemasının 3D hâli

Pano **290 × 240 mm**, dış kenarında **1 cm yüksekliğinde çerçeve** var:
parçalar panodan kaymaz. 300 × 300 tablaya sığar.

**Kloroplast zarının kendisi de çıkarılabilir bir parça.** Çift çizgili oval
halka, dört pimiyle panodaki oyuklara oturur; kaldırınca elinde kalır.

## ÖNCE BUNU OKU — hangi dosyayı açacaksın

Her STL kendi merkezine hizalı. **Hepsini birden açarsan üst üste görünürler.**

| Ne yapacaksın | Hangi dosya |
|---|---|
| **Nasıl göründüğüne bakmak** | `00-MONTAJ-sadece-goruntuleme.stl` — tek dosya, her şey takılı |
| **Basmak** | `baski-1-pano` · `baski-2-kloroplast-zari` · `baski-3-parcalar` · `baski-4-renkli-oklar` — dördünü ayrı ayrı dilimle |
| **Tek tek renkli basmak** | `parca-*.stl`, `renkli-ok-*.stl` — her seferinde bir dosya |

## Parçalar nasıl oturuyor

Evet — **her parçanın panoda kendi biçiminde bir oyuğu var.** Yıldızın yıldız
oyuğu, karonun karo oyuğu, granumun daire oyuğu. Yanlış yere girmez.

- Oyuk derinliği **2,5 mm**, parça kalınlığı **5,3 mm** → 2,8 mm dışarıda
  kalır, parmakla rahat çıkar.
- Her kenarda **0,4 mm** pay var.
- Kloroplast zarı farklı: pano yüzeyine oturur, **dört pimi** oyuklara girer.

## Oklar

İnceltildi (gövde 10 → 5,5 mm). **Hiçbir ok zarın üstüne gelmiyor:**
giren/çıkan oklar zarın dışında durup içeriyi gösterir, döngü okları
tamamen zarın içinde kalır. Denetleyicide artık hiçbir muafiyet yok.

Renkli istersen `renkli-ok-*.stl` dosyalarını ayrı renkte basıp panodaki
kabartmanın üstüne yapıştır — birebir oturur.

| Dosya | Kitaptaki rengi |
|---|---|
| `renkli-ok-h2o`, `renkli-ok-o2` | mor/mavi |
| `renkli-ok-co2`, `renkli-ok-glikoz` | koyu yeşil |
| `renkli-ok-isik` (3 ok tek parça) | turuncu |
| `renkli-ok-dongu` (4 ok tek parça) | siyah/gri |

## Yazılar siyah nasıl olur

Yazılar 1 mm kabartma. Baskı bitince siyah keçeli kalemi panonun üstünden
düz sür — boya sadece harflerin üst yüzüne değer. Taşarsa ıslak mendille sil.

## Parça listesi

| Dosya | Parça | Ölçü (mm) |
|---|---|---|
| `pano-zemin.stl` | Pano, 1 cm çerçeveli, 12 oyuk + 4 zar pimi oyuğu | 290 × 240 × 16 |
| `parca-kloroplast-zari.stl` | **Kloroplast zarı** — çıkarılabilir çift zar halkası | 250 × 170 × 7 |
| `parca-granum.stl` | Granum — 7 tilakoit, üzerinde yazı yok | 32 × 32 × 38 |
| `parca-kalvin.stl` | Kalvin döngüsü | 64 × 68 × 6 |
| `parca-isik.stl` | Işık (güneş) | 34 × 34 × 5 |
| `parca-su.stl` | H₂O | 27 × 17 × 5 |
| `parca-karbondioksit.stl` | CO₂ | 27 × 17 × 5 |
| `parca-oksijen.stl` | O₂ | 20 × 17 × 5 |
| `parca-glikoz.stl` | C₆H₁₂O₆ | 43 × 16 × 5 |
| `parca-atp.stl` | ATP | 31 × 33 × 5 |
| `parca-adp.stl` | ADP | 30 × 31 × 5 |
| `parca-fosfat.stl` | P | 16 × 16 × 5 |
| `parca-nadph.stl` | NADPH | 33 × 13 × 5 |
| `parca-nadp-arti.stl` | NADP⁺ | 32 × 13 × 5 |

Toplam ≈ 174 g filament. Pano ~6 saat, zar ~2 saat, parçalar ~2 saat.

## Baskı ayarları

PLA · katman **0,2 mm** · dolgu %12 · duvar 3 hat · **destek gerekmez**.
0,3 mm katman kullanma, yazılar okunmaz.
Zar halkası uzun ve ince — **brim kullan**, köşeler kalkmasın.

### Renk önerisi
pano beyaz · zar açık mavi · granum yeşil · Kalvin mavi · ATP ve P sarı ·
ADP açık yeşil · NADPH ve NADP⁺ beyaz · H₂O ve CO₂ mavi · O₂ ve glikoz
kırmızı · güneş sarı

## Denetim

- `node tools/yerlesim-denetle.mjs` → üstten görünüşte çakışma ölçer.
  **Hiçbir muafiyet yok**; "Çakışma yok ✓" demeli.
- `node tools/yer-ara.mjs STROMA --ic` → bir yazı için çakışmasız konum arar
- Bütün STL'ler kapalı yüzey (manifold) olarak doğrulandı

## Anlatım sırası

1. **Kloroplast zarını** tak: "Hücrede fotosentez burada olur, çift zarlı."
2. **Granum** → "ışığa bağımlı tepkimeler burada."
3. **Işık** + **H₂O** → "su parçalanır."
4. **O₂** → "açığa çıkar."
5. **ATP** + **NADPH** → "granumda üretilir, stromaya taşınır."
6. **Kalvin döngüsü** → "ışık gerekmez."
7. **CO₂** → "karbon buraya girer."
8. **C₆H₁₂O₆** → "ürün budur."
9. **ADP** + **P** → "enerji boşalır, granuma döner; döngü kapanır."
