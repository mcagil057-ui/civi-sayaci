# Fotosentez 3D Ders Modeli — kloroplast kesiti

Baskıya hazır 11 STL parçası. Hepsi **düz tabanlı** üretildi: destek gerekmez,
hepsi kapalı yüzeydir (watertight / manifold), dilimleyici uyarı vermez.

Dosyaları yeniden üretmek / ölçü değiştirmek için: `node tools/fotosentez-uret.mjs`
veya tarayıcıda `modelleyici.html`.

## Parça listesi

| Dosya | Ne temsil eder | Ölçü (mm) |
|---|---|---|
| `1-kloroplast-govdesi.stl` | Dış zar, iç zar, zarlar arası boşluk ve stroma tabanı | 140 × 70 × 22 |
| `2-granum-6-disk.stl` | Granum — üst üste binmiş 6 tilakoit kesesi | 18,5 × 18,5 × 23 |
| `2-granum-5-disk.stl` | Granum — 5 tilakoit | 18,5 × 18,5 × 19 |
| `2-granum-4-disk.stl` | Granum — 4 tilakoit | 18,5 × 18,5 × 15 |
| `2-granum-3-disk.stl` | Granum — 3 tilakoit | 18,5 × 18,5 × 11 |
| `3-stroma-lamelleri.stl` | Granumları bağlayan 4 stroma lameli | 30 × 40 × 2 |
| `4-nisasta-ve-plastoglobul.stl` | 2 nişasta granülü + 4 plastoglobül | 72 × 14 × 7 |
| `5-akis-oklari.stl` | CO₂ ve H₂O giriş, O₂ ve glikoz çıkış okları | 40 × 75 × 3 |
| `6-etiket-plakalari.stl` | Üzerine yazılacak 6 etiket plakası | 34 × 87 × 1,6 |
| `6-etiket-rayi.stl` | Plakaların dik durduğu ray | 120 × 14 × 9 |
| `7-gunes-isigi.stl` | Güneş ışığı sembolü | 66 × 66 × 3 |

Toplam ≈ 28 g filament (%30 dolgu, PLA).

## Baskı ayarları

- Malzeme: PLA · Katman: 0,2 mm · Dolgu: %15–20 · Duvar: 3 hat
- Destek: **gerekmez** · Tabla yapışması: skirt yeterli
- Tavsiye edilen renkler: gövde açık yeşil, granumlar koyu yeşil, lameller sarı,
  nişasta beyaz, giriş okları mavi, çıkış okları kırmızı, güneş sarı.

## Montaj

1. Gövdenin stroma tabanındaki **5 halka yuvaya** granumları oturt
   (granumların altındaki 0,6 mm'lik pim yuvaya geçer). Gerekirse bir damla yapıştırıcı.
2. Stroma lamellerini iki granum arasına yatık olarak yapıştır — tilakoit
   sisteminin birbirine bağlı olduğunu gösterir.
3. Nişasta granüllerini ve plastoglobülleri stromaya serbest yerleştir.
4. Etiket plakalarına kalemle yaz, raya geçir ve modelin önüne koy:
   `Dış zar` · `İç zar` · `Stroma` · `Granum` · `Tilakoit` · `Nişasta`
5. Okları modelin kenarına diz: **giren** CO₂ ve H₂O, **çıkan** O₂ ve glikoz.
6. Güneşi modelin üst köşesine yaslat.

## Anlatım notu (sunum için)

6 CO₂ + 6 H₂O + ışık enerjisi → C₆H₁₂O₆ + 6 O₂

- **Işığa bağımlı tepkimeler** granumlardaki tilakoit zarlarda olur: su parçalanır,
  O₂ açığa çıkar, ATP ve NADPH üretilir.
- **Calvin döngüsü (ışıktan bağımsız)** stromada olur: CO₂ tutulur, glikoz sentezlenir,
  fazlası nişasta granülü olarak depolanır.

Modelde granumların yeşil, stromanın açık renk olması bu iki aşamayı ayırt ettirir.
