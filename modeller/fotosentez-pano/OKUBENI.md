# Fotosentez Panosu — sökülüp takılabilir 3D şema

Ders kitabındaki fotosentez şemasının üç boyutlu hâli. Zemin bir pano,
moleküller ve yapılar **pimli parçalar** olarak soketlere takılıyor.

Yeniden üretmek / ölçü değiştirmek: `node tools/fotosentez-pano-uret.mjs`

## Nasıl çalışıyor

- Panoda **11 soket** var; hepsi aynı çapta (Ø8 mm pim).
- Bütün soketler aynı olduğu için parçalar her yere takılabilir — yani
  **doğru yere takmak öğrencinin işi.** Sunumda hocan "glikoz nereye gider?"
  diye sorabilir, sen takarak gösterirsin.
- Pano üzerinde sabit olanlar: çift zar, ok yönleri, bölge adları ve
  fotosentez denklemi. Değişken olanlar takılıp çıkarılıyor.

## Dosyalar

| Dosya | Parça | Ölçü (mm) |
|---|---|---|
| `pano-zemin.stl` | Pano (kloroplast şeması, kabartma yazılar, 11 soket) | 200 × 150 × 8 |
| `parca-granum.stl` | Granum — 6 tilakoit yığını | 30 × 30 × 30 |
| `parca-kalvin.stl` | Kalvin döngüsü (dairesel ok) | 40 × 40 × 8 |
| `parca-atp.stl` | ATP | 21 × 22 × 7 |
| `parca-adp-fosfat.stl` | ADP + P | 38 × 14 × 7 |
| `parca-nadph.stl` | NADPH | 28 × 13 × 7 |
| `parca-nadp-arti.stl` | NADP⁺ | 27 × 13 × 7 |
| `parca-su.stl` | H₂O | 26 × 14 × 7 |
| `parca-karbondioksit.stl` | CO₂ | 26 × 14 × 7 |
| `parca-oksijen.stl` | O₂ | 24 × 14 × 7 |
| `parca-glikoz.stl` | Glikoz C₆H₁₂O₆ | 42 × 14 × 7 |
| `parca-isik.stl` | Işık (güneş) | 28 × 28 × 7 |

ADP ile fosfat tek parçada birleştirildi (`ADP + P`): ayrı dururken panoda
yeterli boşluk kalmıyordu, kimyasal olarak da birlikte anılırlar.

Toplam ≈ 57 g filament. Pano tek başına ~2,5 saat, parçalar toplu ~1,5 saat.

## Baskı ayarları

- PLA · katman 0,2 mm · dolgu %15 · duvar 3 hat
- **Destek gerekmez** (soketler delik değil, yükseltilmiş halka).
- Yazılar 0,8 mm kabartmadır; 0,2 mm katmanda net çıkar. 0,3 mm katman kullanma.
- Pano 200 × 150 mm; 220 × 220 tablaya sığar. Daha küçük tablan varsa söyle,
  panoyu iki parçaya bölebilirim.

### Renk önerisi
pano beyaz/gri · granum koyu yeşil · kalvin mavi · ATP ve P sarı · ADP açık yeşil ·
NADPH ve NADP⁺ beyaz · H₂O ve CO₂ mavi · O₂ ve glikoz kırmızı · ışık sarı

## Yerleşim denetimi

`node tools/yerlesim-denetle.mjs` panodaki bütün kabartmaların ve takılı
parçaların üstten görünüşteki ayak izlerini 0,4 mm'lik gözlere tarayıp
çakışma olup olmadığını ölçer. Ölçü değiştirirsen bunu çalıştır; çıktı
"Çakışma yok ✓" demeli.

## Pim sıkılığı

Pim Ø8,0 mm, soket Ø8,7 mm. Yazıcın bollukta basıyorsa parçalar gevşek durabilir;
sıkı istersen `assets/fotosentez-pano.js` içindeki `bosluk: 0.35` değerini
0,25'e düşür ve yeniden üret.

## Anlatım sırası (sunumda)

1. Boş panoyu göster: "Bu bir kloroplast. Çift zarlı, içi stroma."
2. **Granum**'u tak: "Işığa bağımlı tepkimeler burada, tilakoit zarlarda."
3. **Işık**, **H₂O** tak: "Su parçalanır."
4. **O₂** tak: "Açığa oksijen çıkar, atmosfere verilir."
5. **ATP** ve **NADPH** tak: "Granumda üretilen enerji, stromaya taşınır."
6. **Kalvin döngüsü**'nü tak: "Işık gerekmez, stromada olur."
7. **CO₂** tak: "Karbon buraya girer, tutulur."
8. **Glikoz** tak: "Ürün budur."
9. **ADP + P** tak: "Enerji boşalır, granuma geri döner — döngü kapanır."

Soldaki sütun (ATP, ADP + P) granuma, sağdaki (NADPH, NADP⁺) Kalvin
döngüsüne yakın durur; yerleşim akış yönünü kendiliğinden anlatır.

Denklem panonun altında yazılı: 6CO₂ + 6H₂O + ışık → C₆H₁₂O₆ + 6O₂
