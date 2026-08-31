# Proje: Ses–Metin Uyuşma Kontrolü

## Amaç

Kullanıcı bir ses kaydı ve bir referans metin veriyor. Sistem sesi metne
çeviriyor, referans metinle karşılaştırıyor ve uyuşup uyuşmadığına dair
değerlendirme döndürüyor.

## Kesin kural: hiçbir ücretli servis kullanılmayacak

* API çağrısı YOK (OpenAI, Anthropic, Google dahil)
* Her şey yerel makinede çalışacak
* Sadece açık kaynak / ücretsiz indirilebilen araçlar
* Kod içine hiçbir API anahtarı yazılmayacak

## Donanım

Tek makine: dizüstü. Makine yaşlı, kaynak kullanımına dikkat edilecek;
küçük ve verimli seçenekler tercih edilecek.

## Akış

1. Girdi: ses dosyası (mp3, wav, m4a) + referans metin
2. Ses metne çevrilir (faster-whisper)
3. Çıkan metin referans metinle karşılaştırılır
4. Çıktı:
   * uyuşma yüzdesi
   * eksik / fazla / yanlış söylenen kelimeler
   * kısa değerlendirme cümlesi (yerel LLM ile)

## Mimari isteği

Model çağrısı doğrudan uygulama koduna yazılmayacak. Ayrı bir `ai_client`
katmanı olacak; model adı, adres ve port tek bir ayar dosyasından (config)
değişebilecek. Sebep: ileride başka uygulamalar da aynı katmanı kullanacak ve
modüller başka makineye taşınabilecek — sadece adres değişerek.

## Kurulacak araçlar

* Ollama
* Donanıma uygun boyutta bir yerel model
* faster-whisper
* ffmpeg

## Yapılacaklar sırası

1. Donanım raporu + onay
2. Ollama kurulumu ve model indirme
3. `ai_client` katmanı + config dosyası
4. Ses→metin modülü
5. Karşılaştırma modülü (noktalama ve büyük/küçük harf farkı yok sayılsın)
6. Değerlendirme cümlesi üretimi
7. Örnek ses + örnek metinle uçtan uca test

## Çalışma şekli

* Her adımda ne yapıldığı ve NEDEN öyle yapıldığı sade dille açıklanacak
* Büyük indirmelerden önce boyut söylenip onay alınacak
* Açıklamalar Türkçe

---

Uygulama `ses-metin/` dizinindedir; kurulum ve kullanım için
[ses-metin/README.md](ses-metin/README.md).
