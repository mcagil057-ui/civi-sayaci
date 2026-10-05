# Fotosentez Panosu — ders kitabı şemasının 3D hâli

Kitaptaki bilgi görselinin üç boyutlu karşılığı. Zemin bir pano; moleküller ve
yapılar **pimli parçalar** olarak soketlere takılıp çıkarılıyor.

Yeniden üretmek: `node tools/fotosentez-pano-uret.mjs`
Yerleşimi denetlemek: `node tools/yerlesim-denetle.mjs`

## Panoda sabit olanlar

Çift zarlı kloroplast konturu · H₂O, CO₂, O₂ ve glikoz okları · güneşten gelen
üç ışık oku · granum ile Kalvin döngüsü arasındaki dört ince döngü oku ·
`GRANUM`, `STROMA`, `KLOROPLAST` kabartma yazıları.

## Takılıp çıkarılan 12 parça

| Dosya | Parça | Ölçü (mm) |
|---|---|---|
| `pano-zemin.stl` | Pano (12 soket) | 200 × 150 × 8 |
| `parca-granum.stl` | Granum — 6 tilakoit yığını (üzerinde yazı yok) | 30 × 30 × 30 |
| `parca-kalvin.stl` | Kalvin döngüsü — dairesel ok, içinde `IŞIĞIN KULLANILMADIĞI TEPKİMELER` | 58 × 62 × 8 |
| `parca-isik.stl` | Işık (güneş) | 28 × 28 × 7 |
| `parca-su.stl` | H₂O | 26 × 14 × 7 |
| `parca-karbondioksit.stl` | CO₂ | 26 × 14 × 7 |
| `parca-oksijen.stl` | O₂ | 24 × 14 × 7 |
| `parca-glikoz.stl` | C₆H₁₂O₆ | 42 × 14 × 7 |
| `parca-atp.stl` | ATP | 21 × 22 × 7 |
| `parca-adp.stl` | ADP | 19 × 20 × 7 |
| `parca-fosfat.stl` | P (fosfat) | 14 × 14 × 7 |
| `parca-nadph.stl` | NADPH | 28 × 13 × 7 |
| `parca-nadp-arti.stl` | NADP⁺ | 27 × 13 × 7 |

Toplam ≈ 58 g filament. Pano ~2,5 saat, parçalar toplu ~1,5 saat.

## Baskı ayarları

- PLA · katman **0,2 mm** · dolgu %15 · duvar 3 hat
- **Destek gerekmez** (soketler delik değil, yükseltilmiş halka).
- Yazılar 0,8 mm kabartma. 0,3 mm katman kullanma, okunmaz.
- Pano 200 × 150 mm; 220 × 220 tablaya sığar.

### Renk önerisi (kitaptaki renkler)
pano beyaz · granum yeşil · Kalvin mavi · ATP sarı · ADP açık yeşil · P sarı ·
NADPH ve NADP⁺ beyaz · H₂O ve CO₂ mavi · O₂ ve glikoz kırmızı · güneş sarı

## Kitaptan farklar

Birebir kopyalanamayan üç nokta:

1. **Kloroplast konturu** kitapta kubbemsi; burada elips. Baskıda ve üretimde
   daha güvenilir bir eğri.
2. **Döngü okları** kitapta ince ve kavisli; burada dört kısa düz ok. Kavisli
   olanlar 3 mm genişlikte basıldığında kopuyor.
3. Kitapta granumun üzerinde yazan `IŞIĞIN KULLANILDIĞI TEPKİMELER` ibaresi,
   isteğin üzerine kaldırıldı. Granumun üstü düz; adı panoda yazıyor.

## Pim sıkılığı

Pim Ø8,0 mm, soket Ø8,7 mm. Gevşek durursa `assets/fotosentez-pano.js`
içindeki `bosluk: 0.35` değerini 0,25 yapıp yeniden üret.

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
