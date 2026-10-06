# Fotosentez Panosu — ders kitabı şemasının 3D hâli

Pano **290 × 240 mm**, dış kenarında **1 cm yüksekliğinde çerçeve** var:
parçalar panodan kaymaz. 300 × 300 tablaya sığar.

**Kloroplast zarının kendisi de çıkarılabilir bir parça.** Çift çizgili oval
halka, dört pimiyle panodaki oyuklara oturur; kaldırınca elinde kalır.

## ÖNCE BUNU OKU — hangi dosyayı açacaksın

Her STL kendi merkezine hizalı. **Hepsini birden açarsan üst üste görünürler.**

| Ne yapacaksın | Hangi dosya |
|---|---|
| **Tek dosyada hepsi** | `00-HEPSI-TEK-DOSYA.stl` — 25 parçanın hepsi yan yana. Dilimleyicide **parçalara ayır** (PrusaSlicer: sağ tık → *Nesnelere ayır*, Cura: *Modeli parçalara böl*), sonra gruplar hâlinde bas. 290 × 568 mm olduğu için tek seferde basılmaz. |
| **Nasıl göründüğüne bakmak** | `00-MONTAJ-sadece-goruntuleme.stl` — tek dosya, her şey takılı |
| **Basmak** | `baski-1-pano` · `baski-2-kloroplast-zari` · `baski-3-parcalar` · `baski-4-oklar` — dördünü ayrı ayrı dilimle |
| **Tek tek renkli basmak** | `parca-*.stl` — her seferinde bir dosya |

## Parçalar nasıl oturuyor

Evet — **her parçanın panoda kendi biçiminde bir oyuğu var.** Yıldızın yıldız
oyuğu, karonun karo oyuğu, granumun daire oyuğu. Yanlış yere girmez.

- Oyuk derinliği **3,5 mm**, parça kalınlığı **5,5 mm** → 2 mm dışarıda
  kalır, parmakla rahat çıkar.
- Her kenarda **0,4 mm** pay var.
- Kloroplast zarı farklı: pano yüzeyine oturur, **dört pimi** oyuklara girer.

## Oklar

İnceltildi (gövde 10 → 5,5 mm; döngü ve ışık okları 4,5 mm) ve **hepsi
çıkarılabilir parça oldu.** Her okun panoda kendi biçiminde oyuğu var.

Hiçbir ok zara değmiyor: giren/çıkan oklar zarın dışında durup içeriyi
gösterir, döngü okları tamamen zarın içinde kalır.

## Yazılar siyah nasıl olur

Yazılar 1 mm kabartma. Baskı bitince siyah keçeli kalemi panonun üstünden
düz sür — boya sadece harflerin üst yüzüne değer. Taşarsa ıslak mendille sil.

## Parça listesi — 24 parçanın hepsi çıkarılabilir

**Yapılar ve moleküller (13)**

| Dosya | Parça |
|---|---|
| `parca-kloroplast-zari.stl` | Kloroplast zarı (çift zar halkası, 250 × 170) |
| `parca-granum.stl` | Granum — 7 tilakoit |
| `parca-kalvin.stl` | Kalvin döngüsü |
| `parca-isik.stl` | Işık (güneş) |
| `parca-su.stl` | H₂O |
| `parca-karbondioksit.stl` | CO₂ |
| `parca-oksijen.stl` | O₂ |
| `parca-glikoz.stl` | C₆H₁₂O₆ |
| `parca-atp.stl` | ATP |
| `parca-adp.stl` | ADP |
| `parca-fosfat.stl` | P |
| `parca-nadph.stl` | NADPH |
| `parca-nadp-arti.stl` | NADP⁺ |

**Oklar (11) — bunlar da çıkarılabilir**

| Dosya | Ok | Önerilen renk |
|---|---|---|
| `parca-ok-h2o.stl` | H₂O girer | mor/mavi |
| `parca-ok-o2.stl` | O₂ çıkar | mor/mavi |
| `parca-ok-co2.stl` | CO₂ girer | koyu yeşil |
| `parca-ok-glikoz.stl` | Glikoz çıkar | koyu yeşil |
| `parca-ok-isik-1/2/3.stl` | Işık ışınları (3 ayrı ok) | turuncu |
| `parca-ok-granum-atp.stl` | Granum → ATP | siyah/gri |
| `parca-ok-atp-kalvin.stl` | ATP → Kalvin | siyah/gri |
| `parca-ok-kalvin-nadp.stl` | Kalvin → NADP⁺ | siyah/gri |
| `parca-ok-adp-granum.stl` | ADP+P → granum | siyah/gri |

Panoda sabit kalan tek şey: `GRANUM`, `STROMA`, `KLOROPLAST` kabartma yazıları
ve 1 cm'lik dış çerçeve.

Toplam ≈ 172 g filament.

## Baskı ayarları

PLA · katman **0,2 mm** · dolgu %12 · duvar 3 hat · **destek gerekmez**.
0,3 mm katman kullanma, yazılar okunmaz.
Zar halkası uzun ve ince — **brim kullan**, köşeler kalkmasın.

### Renk önerisi
pano beyaz · zar açık mavi · granum yeşil · Kalvin mavi · ATP ve P sarı ·
ADP açık yeşil · NADPH ve NADP⁺ beyaz · H₂O ve CO₂ mavi · O₂ ve glikoz
kırmızı · güneş sarı

## Denetim raporu

`DENETIM-RAPORU.txt` dosyasında bu modelin tam denetimi var. `node tools/denetim.mjs`
ile her an yeniden alınır. **Sonuç: 0 hata, 0 uyarı.** Kontrol edilenler:

0. **Oyuklar gerçekten açık mı** — panoya 27 noktadan ışın atılıp yüzey kotu
   ölçülür. Hepsi **3,5 mm derin**; oyuk dışındaki noktalar 6,00 mm (düz).
1. **Oyuk uyumu** — 27 oyuğun her birinde parça ile oyuk arası pay ölçüldü: **0,40 mm**
   (güneşin ışın uçlarında 0,30, yıldızların derin köşelerinde 0,59 mm).
2. **Oyuk–göz boşluğu** — hiçbir oyuk gözünün kenarına değmiyor (en az 0,8 mm).
3. **Parça çakışması** — 24 parçanın hiçbiri birbirine değmiyor.
4. **Zar ilişkisi** — içeride olması gerekenlerin hepsi zarın içinde, dışarıdakiler
   dışında. Hiçbir parça ve hiçbir ok zara binmiyor.
5. **Çerçeve** — her şey 1 cm'lik çerçevenin içinde (en yakın parça 4 mm).
6. **Yazılar** — her yazı kendi parçasının içinde kalıyor, hiçbiri taşmıyor.
7. **Zar pimleri** — dört pim ile dört oyuk aynı noktada; pim Ø6,0 / oyuk Ø7,2 mm.
8. **Katı doğrulama** — 25 parçanın hepsi kapalı yüzey (manifold).
9. **Baskı uygunluğu** — her parça 300 × 300 tablaya sığıyor; en ince kesit 4,5 mm.

## Denetim komutları

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
