# -*- coding: utf-8 -*-
"""Kur'an veri paketini uygulama biçimine dönüştürür.

Kaynak edisyonlar (raw.githubusercontent.com/fawazahmed0/quran-api/1/editions):
  ara-quranuthmanihaf.min.json   Osmanî hat (Hafs)
  tur-diyanetvakfi.min.json      meal
  tur-latinalphabet.min.json     Latin okunuş
  ../1/info.json                 cüz / sayfa / secde metadatası
Bu dosyalar bu betiğin yanına indirilir, sonra betik çalıştırılır.


Eşleştirme metni, görüntülenen Osmanî hattın kendisinden türetilir; böylece
ekrandaki kelime ile eşleştirilen kelime her zaman aynı sırada kalır.
"""
import json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sure_adlari import SURAHS_TR

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(SRC), "tilavet", "data")

def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f)["quran"]

uthmani = load("ara-quranuthmanihaf.json")
meal    = load("tur-diyanetvakfi.json")
latin   = load("tur-latinalphabet.json")
info    = json.load(open(os.path.join(SRC, "info.json"), encoding="utf-8"))

# --- Arapça normalizasyon -----------------------------------------------
# Küçük (üstteki) harfler telaffuz edilir; silmek yerine tam harfe çevrilir.
PRE = {"ٰ": "ا", "ۥ": "و", "ۦ": "ي"}
# Hareke, tecvid işaretleri, tatvil: tamamen atılır.
STRIP = re.compile("[ؐ-ًؚ-ٟۖ-ۭـ࣓-ࣿ​-‏]")
LETTER = {"أ":"ا","إ":"ا","آ":"ا","ٱ":"ا","ٲ":"ا",
          "ٳ":"ا","ى":"ي","ة":"ه","ؤ":"و","ئ":"ي"}
KEEP = re.compile("[^ء-ي ]")

def normalize(text):
    t = "".join(PRE.get(c, c) for c in text)
    t = STRIP.sub("", t)
    t = "".join(LETTER.get(c, c) for c in t)
    t = t.replace("ء", "")          # tek başına hemze
    t = KEEP.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()

BARE = lambda w: "".join(c for c in w if not unicodedata.combining(c))
ORPHAN = ("\u0627", "\u0649")   # yalnız kalmis elif / elif maksure

def clean_display(text):
    """Bosluklari tekillestirir ve bolunmus tenvin-elifini birlestirir.

    Kaynak veride 'narAN' gibi kelimeler iki jetona ayrilmis (govde + elif);
    bu hem hatti bozuyor hem kelime sayisini sisiriyordu."""
    text = re.sub(r"\s+", " ", text.replace("\u00a0", " ")).strip()
    out = []
    for w in text.split(" "):
        if out and BARE(w) in ORPHAN:
            out[-1] += w
        else:
            out.append(w)
    return " ".join(out)

# --- sure metadatası -----------------------------------------------------
sureler, offset = [], 0
for ch in info["chapters"]:
    n = ch["chapter"]
    ad, anlam = SURAHS_TR[n - 1]
    # Sûrenin Arapça adı bir gösterim metnidir: normalize edilmez, harekesiyle
    # birlikte olduğu gibi kalır (normalize edilince "يسٓ" -> "ياس" oluyordu).
    ar = clean_display(re.sub(r"^\s*سُوْرَةُ\s*", "", ch["arabicname"]))
    sureler.append({
        "n": n, "ad": ad, "anlam": anlam, "ar": ar,
        "ayet": len(ch["verses"]), "inis": "Mekke" if ch["revelation"] == "Mecca" else "Medine",
        "sayfa": ch["verses"][0]["page"], "cuz": ch["verses"][0]["juz"], "ofset": offset,
    })
    offset += len(ch["verses"])
assert offset == 6236

meta = {
    "v": 1, "toplamAyet": offset, "sure": sureler,
    "cuz":    [{"n": r["juz"],  "s": r["start"]["chapter"], "a": r["start"]["verse"]} for r in info["juzs"]["references"]],
    "sayfa":  [{"n": r["page"], "s": r["start"]["chapter"], "a": r["start"]["verse"]} for r in info["pages"]["references"]],
    "secde":  [[r["chapter"], r["verse"]] for r in info["sajdas"]["references"]],
}

# --- ayet metinleri ------------------------------------------------------
os.makedirs(os.path.join(OUT, "text"), exist_ok=True)
by_surah, match_all, mismatch, empty_tokens = {}, [], 0, 0
for i, v in enumerate(uthmani):
    s, a = v["chapter"], v["verse"]
    disp = clean_display(v["text"])
    words = disp.split(" ")
    norm_words = []
    for w in words:
        nw = normalize(w)
        if not nw:                        # hizayı korumak için boş bırakma
            nw = "ـ"
            empty_tokens += 1
        norm_words.append(nw)
    # normalize() bir kelimeyi bölerse hizalama bozulur; birleştirerek koru
    norm_words = [w.replace(" ", "") for w in norm_words]
    if len(norm_words) != len(words):
        mismatch += 1
    by_surah.setdefault(s, []).append({
        "v": a, "u": disp,
        "m": clean_display(meal[i]["text"]), "l": clean_display(latin[i]["text"]),
    })
    match_all.append(" ".join(norm_words))

for s, ayetler in by_surah.items():
    with open(os.path.join(OUT, "text", "%03d.json" % s), "w", encoding="utf-8") as f:
        json.dump({"n": s, "ayetler": ayetler}, f, ensure_ascii=False, separators=(",", ":"))

json.dump(meta, open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
json.dump(match_all, open(os.path.join(OUT, "match.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))

print("ayet:", len(match_all), "| hiza uyuşmazlığı:", mismatch, "| boş jeton:", empty_tokens)
print("kelime:", sum(len(m.split(" ")) for m in match_all))
print("örnek 1:1 ->", match_all[0])
print("örnek 1:2 ->", match_all[1])
print("örnek 2:2 ->", match_all[8])
