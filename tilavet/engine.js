/*!
 * Tilavet eşleştirme motoru
 * -------------------------
 * Bu dosyanın DOM ile hiçbir ilişiği yoktur; tarayıcıda da Node'da da aynı
 * şekilde çalışır ve testleri Node ile koşar.
 *
 * Uygulamanın asıl zorluğu ses tanıma değil, tanınanı metne oturtmaktır.
 * Motor üç işi yapar:
 *   1. normalizasyon  — Osmanî hat ile tanıyıcı çıktısını ortak bir forma indirger
 *   2. konum bulma    — "şu an neresini okuyorum?" (tüm Kur'an üzerinde arama)
 *   3. takip          — imleci kelime kelime ilerletir ve hataları sınıflandırır
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tilavet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ==================================================================
   * 1. Normalizasyon
   * ------------------------------------------------------------------
   * Buradaki kurallar veri paketini üreten Python betiğiyle birebir
   * aynıdır. Biri değişirse diğeri de değişmeli, yoksa ekrandaki metinle
   * eşleştirme metni birbirini tutmaz.
   * ================================================================== */

  // Osmanî hatta üste yazılan küçük harfler telaffuz edilir; silmek yerine
  // tam harfe çevrilir (ٱلۡعَٰلَمِينَ -> العالمين).
  var PRE = { 'ٰ': 'ا', 'ۥ': 'و', 'ۦ': 'ي' };
  // Hareke, tecvid işaretleri, tatvil ve yön imleri: tamamen atılır.
  var STRIP = /[ؐ-ًؚ-ٟۖ-ۭـ࣓-ࣿ​-‏]/g;
  // Yazım varyantlarını tek forma indirger.
  var LETTER = {
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
    'ٲ': 'ا', 'ٳ': 'ا', 'ى': 'ي', 'ة': 'ه',
    'ؤ': 'و', 'ئ': 'ي'
  };
  var KEEP = /[^ء-ي ]/g;
  var ALEF = 'ا';

  function normalize(text) {
    if (!text) return '';
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      out += (PRE[c] !== undefined ? PRE[c] : c);
    }
    out = out.replace(STRIP, '');
    var mapped = '';
    for (var j = 0; j < out.length; j++) {
      var d = out[j];
      mapped += (LETTER[d] !== undefined ? LETTER[d] : d);
    }
    mapped = mapped.split('ء').join('');       // tek başına hemze
    return mapped.replace(KEEP, ' ').replace(/\s+/g, ' ').trim();
  }

  function tokens(text) {
    var n = normalize(text);
    return n ? n.split(' ') : [];
  }

  /* ------------------------------------------------------------------
   * İskelet (consonantal skeleton)
   *
   * Osmanî imlâ ile modern imlâ arasındaki farkın neredeyse tamamı elif
   * kaynaklıdır: العالمين/العلمين, الرحمن/الرحمان, ذلك/ذالك. Elifi atıp
   * tekrar eden harfleri tekleştirince iki yazım aynı iskelete iner.
   * Vav ve ye'ye dokunulmaz — onlar çoğu yerde gerçek sessizdir.
   * ------------------------------------------------------------------ */
  var skCache = new Map();
  function skeleton(word) {
    if (!word) return '';
    var hit = skCache.get(word);
    if (hit !== undefined) return hit;
    var s = '', prev = '';
    for (var i = 0; i < word.length; i++) {
      var c = word[i];
      if (c === ALEF) continue;
      if (c !== prev) { s += c; prev = c; }
    }
    if (!s) s = word;
    if (skCache.size < 200000) skCache.set(word, s);
    return s;
  }

  /* ------------------------------------------------------------------
   * Kelime benzerliği: kademeli, ucuzdan pahalıya.
   * ------------------------------------------------------------------ */
  function levenshtein(a, b, cap) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > cap) return cap + 1;
    var prev = new Array(lb + 1), cur = new Array(lb + 1), i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var best = cur[0];
      for (j = 1; j <= lb; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < best) best = cur[j];
      }
      if (best > cap) return cap + 1;
      var t = prev; prev = cur; cur = t;
    }
    return prev[lb];
  }

  function wordSim(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (skeleton(a) === skeleton(b)) return 0.92;
    var m = Math.max(a.length, b.length);
    var cap = Math.floor(m * 0.35);
    if (cap < 1) return 0;
    var d = levenshtein(a, b, cap);
    if (d > cap) return 0;
    var ratio = 1 - d / m;
    return ratio >= 0.7 ? ratio * 0.9 : 0;
  }

  /**
   * Serbest hizalama.
   *
   * Tanıyıcı bir kelimeyi ikiye bölebilir ("ياايها" -> "يا" + "ايها") ya da
   * iki kelimeyi birleştirebilir. Kelimeleri sırayla birebir karşılaştırmak
   * bu yüzden yanıltır: tek bir bölünme, sonraki tüm kelimeleri kaydırır.
   * Küçük bir dinamik programlama ile 1:1, 2:1 ve 1:2 eşleşmelere izin verilir;
   * fazladan söylenen ya da atlanan kelime ceza alır.
   */
  function alignScore(spoken, words, start, pencere) {
    var n = spoken.length;
    var m = Math.min(pencere === undefined ? n + 3 : pencere, words.length - start);
    if (n === 0 || m <= 0) return { score: 0, matched: 0, consumed: 0 };
    var EKSIK = -1e9, FAZLA_CEZA = -0.15, ATLAMA_CEZA = -0.2;
    var d = [], mt = [], i, j;
    for (i = 0; i <= n; i++) {
      d.push(new Float64Array(m + 1).fill(EKSIK));
      mt.push(new Int32Array(m + 1));
    }
    d[0][0] = 0;
    for (i = 0; i <= n; i++) {
      for (j = 0; j <= m; j++) {
        var cur = d[i][j];
        if (cur === EKSIK) continue;
        var base = mt[i][j], sim, val;
        if (i < n && j < m) {                                  // 1:1
          sim = wordSim(spoken[i], words[start + j]);
          val = cur + sim;
          if (val > d[i + 1][j + 1]) { d[i + 1][j + 1] = val; mt[i + 1][j + 1] = base + (sim > 0 ? 1 : 0); }
        }
        if (i + 1 < n && j < m) {                              // 2:1 (tanıyıcı bölmüş)
          sim = wordSim(spoken[i] + spoken[i + 1], words[start + j]);
          if (sim > 0) {
            val = cur + sim;
            if (val > d[i + 2][j + 1]) { d[i + 2][j + 1] = val; mt[i + 2][j + 1] = base + 1; }
          }
        }
        if (i < n && j + 1 < m) {                              // 1:2 (tanıyıcı birleştirmiş)
          sim = wordSim(spoken[i], words[start + j] + words[start + j + 1]);
          if (sim > 0) {
            val = cur + sim;
            if (val > d[i + 1][j + 2]) { d[i + 1][j + 2] = val; mt[i + 1][j + 2] = base + 1; }
          }
        }
        if (i < n) {                                           // fazladan söylenen
          val = cur + FAZLA_CEZA;
          if (val > d[i + 1][j]) { d[i + 1][j] = val; mt[i + 1][j] = base; }
        }
        if (j < m) {                                           // atlanan
          val = cur + ATLAMA_CEZA;
          if (val > d[i][j + 1]) { d[i][j + 1] = val; mt[i][j + 1] = base; }
        }
      }
    }
    var best = 0, bestJ = 0, bestM = 0;
    for (j = 0; j <= m; j++) {
      if (d[n][j] > best) { best = d[n][j]; bestJ = j; bestM = mt[n][j]; }
    }
    return { score: Math.max(0, best) / n, matched: bestM, consumed: bestJ };
  }

  /* ==================================================================
   * 2. Dizin — "şu an neresini okuyorum?"
   * ------------------------------------------------------------------
   * Üçlü kelime dizileri (trigram) iskelet üzerinden dizinlenir. Aranan
   * söz dizisindeki her trigramın dizindeki her eşleşmesi, "bu okuma şu
   * konumda başlamış olmalı" diye bir oy verir. En çok oy alan başlangıç
   * kazanır. Shazam'ın ofset histogramının metin karşılığı.
   * ================================================================== */
  function QuranIndex(corpus) {
    this.ayahCount = corpus.length;
    var words = [], ayahOf = [], posOf = [], ayahStart = new Int32Array(corpus.length);
    for (var a = 0; a < corpus.length; a++) {
      ayahStart[a] = words.length;
      var ws = corpus[a] ? corpus[a].split(' ') : [];
      for (var w = 0; w < ws.length; w++) {
        words.push(ws[w]); ayahOf.push(a); posOf.push(w);
      }
    }
    this.words = words;
    this.ayahOf = Int32Array.from(ayahOf);
    this.posOf = Int32Array.from(posOf);
    this.ayahStart = ayahStart;
    this.total = words.length;

    this.sk = new Array(this.total);
    for (var i = 0; i < this.total; i++) this.sk[i] = skeleton(words[i]);

    this.gram = new Map();
    for (var k = 0; k + 2 < this.total; k++) {
      var key = this.sk[k] + '|' + this.sk[k + 1] + '|' + this.sk[k + 2];
      var arr = this.gram.get(key);
      if (arr) arr.push(k); else this.gram.set(key, [k]);
    }
    this.uni = new Map();
    for (var u = 0; u < this.total; u++) {
      var uk = this.sk[u];
      var ua = this.uni.get(uk);
      if (ua) { if (ua.length < 900) ua.push(u); } else this.uni.set(uk, [u]);
    }
  }

  QuranIndex.prototype.ayahEnd = function (a) {
    return a + 1 < this.ayahCount ? this.ayahStart[a + 1] : this.total;
  };
  QuranIndex.prototype.ayahLength = function (a) {
    return this.ayahEnd(a) - this.ayahStart[a];
  };
  QuranIndex.prototype.locate = function (flat) {
    if (flat < 0 || flat >= this.total) return null;
    return { ayah: this.ayahOf[flat], word: this.posOf[flat] };
  };

  /**
   * Söylenen kelimelerden konum bulur.
   * @param {string[]} spoken  normalize edilmiş kelimeler
   * @param {{limit?:number, range?:[number,number]}} opts
   * @returns {Array<{flat:number, ayah:number, word:number, score:number, matched:number}>}
   */
  QuranIndex.prototype.find = function (spoken, opts) {
    opts = opts || {};
    var limit = opts.limit || 5;
    var range = opts.range || null;          // [flatBaşlangıç, flatBitiş)
    if (!spoken || !spoken.length) return [];
    var sk = spoken.map(skeleton), votes = new Map(), j, p, start, arr, n;

    for (j = 0; j + 2 < sk.length; j++) {
      arr = this.gram.get(sk[j] + '|' + sk[j + 1] + '|' + sk[j + 2]);
      if (!arr || arr.length > 500) continue;   // çok yaygın kalıp ayırt edici değil
      for (n = 0; n < arr.length; n++) {
        start = arr[n] - j;
        if (start < 0) continue;
        votes.set(start, (votes.get(start) || 0) + 1);
      }
    }
    if (!votes.size) {                          // kısa söz: en nadir kelimeden git
      var rarest = null, rarestLen = Infinity;
      for (j = 0; j < sk.length; j++) {
        arr = this.uni.get(sk[j]);
        if (arr && arr.length < rarestLen) { rarest = j; rarestLen = arr.length; }
      }
      if (rarest === null || rarestLen > 400) return [];
      arr = this.uni.get(sk[rarest]);
      for (n = 0; n < arr.length; n++) {
        start = arr[n] - rarest;
        if (start >= 0) votes.set(start, 1);
      }
    }

    // Oy alan başlangıçları gerçek hizalama puanıyla yeniden sırala.
    var cands = [];
    votes.forEach(function (v, s) { cands.push([s, v]); });
    cands.sort(function (x, y) { return y[1] - x[1]; });
    cands = cands.slice(0, 60);

    // Bölünme/birleşme başlangıcı bir iki kelime kaydırabilir; komşu
    // başlangıçlar da denenir ve en iyi hizalanan kazanır.
    var out = [], self = this, gorulen = new Set(), kaydir = [0, -1, 1, -2, 2];
    cands.forEach(function (c) {
      for (var k = 0; k < kaydir.length; k++) {
        var s = c[0] + kaydir[k];
        if (s < 0 || s >= self.total) continue;
        if (range && (s < range[0] || s >= range[1])) continue;
        if (gorulen.has(s)) continue;
        gorulen.add(s);
        var al = alignScore(spoken, self.words, s);
        if (al.matched >= Math.min(2, spoken.length) && al.score > 0.3) {
          out.push({
            flat: s, ayah: self.ayahOf[s], word: self.posOf[s],
            score: al.score, matched: al.matched, uzunluk: al.consumed
          });
        }
      }
    });
    out.sort(function (x, y) { return y.score - x.score || y.matched - x.matched || x.flat - y.flat; });
    return out.slice(0, limit);
  };

  /* ==================================================================
   * 3. Takipçi — akışkan hizalama ve hata sınıflandırma
   * ------------------------------------------------------------------
   * İmleç beklenen kelimede durur. Gelen her kelime, imlecin etrafındaki
   * dar bir pencerede aranır: pencerede ileride bulunursa aradakiler
   * atlanmış, geride bulunursa tekrar edilmiş demektir.
   *
   * Kritik ayrıntı: hata ANINDA yazılmaz. Ses tanıma bir kelimeyi
   * yutunca kullanıcıya haksız yere "atladın" demek, bu tür uygulamaların
   * en can sıkıcı hatasıdır. Bu yüzden bulgular önce beklemeye alınır ve
   * ancak arkasından gelen birkaç kelime de aynı konumu doğrularsa
   * kesinleşir.
   * ================================================================== */
  var DEFAULTS = {
    back: 4,           // imlecin gerisinde kaç kelime aranır (tekrar yakalama)
    forward: 8,        // ilerisinde kaç kelime aranır (atlama yakalama)
    threshold: 0.75,   // kelime eşleşme eşiği
    confirm: 2,        // bir bulgunun kesinleşmesi için gereken doğrulama
    relocateAfter: 3,  // kaç yabancı kelimeden sonra konum yeniden aranır
    stallMs: 4000      // bu süre ilerleme yoksa "takıldı" sayılır
  };

  function Tracker(index, opts) {
    opts = opts || {};
    this.ix = index;
    this.o = Object.assign({}, DEFAULTS, opts);
    this.range = opts.range || [0, index.total];
    this.cursor = opts.cursor !== undefined ? opts.cursor : this.range[0];
    this.startCursor = this.cursor;
    this.pending = [];        // kesinleşmemiş bulgular
    this.confirmed = [];      // kesinleşmiş bulgular
    this.streak = 0;          // arka arkaya doğru kelime
    this.unknown = [];        // hiçbir yere oturmayan kelimeler
    this.carry = null;        // bölünmüş olabilecek kelime için tampon
    this.sonArama = -99;      // son yeniden konumlanma denemesi (duyulan kelime sayacı)
    this.heard = 0;
    this.correct = 0;
    this.lastAdvance = opts.now || 0;
    this.events = [];
  }

  Tracker.prototype._emit = function (ev) { this.events.push(ev); return ev; };

  Tracker.prototype._commitPending = function () {
    for (var i = 0; i < this.pending.length; i++) {
      this.confirmed.push(this.pending[i]);
      this._emit(this.pending[i]);
    }
    this.pending = [];
  };

  Tracker.prototype._dropPending = function () { this.pending = []; };

  /** Pencerede en iyi konumu bulur. */
  Tracker.prototype._search = function (spokenWord) {
    var best = null, lo = Math.max(this.range[0], this.cursor - this.o.back);
    var hi = Math.min(this.range[1] - 1, this.cursor + this.o.forward);
    for (var p = lo; p <= hi; p++) {
      var sim = wordSim(spokenWord, this.ix.words[p]);
      if (sim < this.o.threshold) continue;
      // Eşit güçteki adaylarda imlece yakın olanı tercih et.
      var adj = sim - Math.abs(p - this.cursor) * 0.015;
      if (!best || adj > best.adj) best = { p: p, sim: sim, adj: adj, span: 1 };
    }
    // Tanıyıcı iki kelimeyi birleştirmiş olabilir (ör. "وقال" -> "و قال").
    if (!best && this.cursor + 1 < this.range[1]) {
      var joined = this.ix.words[this.cursor] + this.ix.words[this.cursor + 1];
      var s2 = wordSim(spokenWord, joined);
      if (s2 >= this.o.threshold) best = { p: this.cursor, sim: s2, adj: s2, span: 2 };
    }
    return best;
  };

  /**
   * Yeni tanınan kelimeleri işler.
   * @param {string[]|string} spoken ham veya normalize metin
   * @param {number} now zaman damgası (ms)
   */
  Tracker.prototype.feed = function (spoken, now) {
    var list = typeof spoken === 'string' ? tokens(spoken) : spoken;
    now = now || 0;
    this.events = [];
    for (var i = 0; i < list.length; i++) this._word(list[i], now);
    return this.events;
  };

  Tracker.prototype._word = function (word, now) {
    if (!word) return;
    this.heard++;

    // Tanıyıcı bir kelimeyi ikiye bölmüş olabilir: önce tampondakiyle
    // birleştirip dene ("يا" + "ايها" -> "ياايها").
    if (this.carry) {
      var birlesik = this._search(this.carry + word);
      if (birlesik) { this.carry = null; this._accept(birlesik, now); return; }
    }

    // Kaybolmuşken tek bir yerel eşleşmeye güvenmek yanıltır: "الذين", "من"
    // gibi sık kelimeler imleci yanlış ayete sürükler. Önce gerçekten
    // neresini okuduğumuzu ara, ancak sonra yerel pencereye bak.
    if (this.unknown.length + (this.carry ? 1 : 0) >= this.o.relocateAfter &&
        this.heard - this.sonArama >= 2) {
      if (this._relocate(now)) return;
    }

    var hit = this._search(word);
    if (!hit) {
      // Hemen "yabancı" deme: sonraki kelimeyle birleşebilir.
      if (this.carry) this.unknown.push(this.carry);
      this.carry = word;
      this.streak = 0;
      return;
    }
    if (this.carry) { this.unknown.push(this.carry); this.carry = null; }
    this._accept(hit, now);
  };

  Tracker.prototype._accept = function (hit, now) {
    // Oturmayan kelimeler bir eşleşmeyle sonuçlandıysa: yanlış okuma.
    if (this.unknown.length) {
      this.pending.push({
        tip: 'yanlis', flat: this.cursor, ayah: this.ix.ayahOf[this.cursor],
        word: this.ix.posOf[this.cursor], duyulan: this.unknown.join(' '),
        beklenen: this.ix.words[this.cursor], t: now
      });
      this.unknown = [];
    }

    if (hit.p > this.cursor) {
      for (var p = this.cursor; p < hit.p; p++) {
        this.pending.push({
          tip: 'atlama', flat: p, ayah: this.ix.ayahOf[p], word: this.ix.posOf[p],
          beklenen: this.ix.words[p], t: now
        });
      }
    } else if (hit.p < this.cursor) {
      this._emit({
        tip: 'tekrar', flat: hit.p, ayah: this.ix.ayahOf[hit.p],
        word: this.ix.posOf[hit.p], t: now
      });
    }

    this.correct++;
    this.streak++;
    this.cursor = hit.p + hit.span;
    this.lastAdvance = now;
    this._emit({
      tip: 'ilerle', flat: hit.p, span: hit.span, ayah: this.ix.ayahOf[hit.p],
      word: this.ix.posOf[hit.p], skor: hit.sim, t: now
    });
    if (this.streak >= this.o.confirm) this._commitPending();
  };

  /** İmleç kaybolduğunda okunan aralıkta gerçek konumu arar. */
  Tracker.prototype._relocate = function (now) {
    if (this.carry) { this.unknown.push(this.carry); this.carry = null; }
    var probe = this.unknown.slice(-6);
    this.sonArama = this.heard;
    if (probe.length < 2) return false;

    var res = this.ix.find(probe, { limit: 1, range: this.range });
    if (!res.length || res[0].score < 0.6) {
      if (this.unknown.length >= this.o.relocateAfter * 3) {
        this._emit({ tip: 'kayip', flat: this.cursor, ayah: this.ix.ayahOf[this.cursor], t: now });
        this.unknown = [];
      }
      return false;
    }

    // Hizalama, sondanın kaç kelimeyi kapladığını söyler; imleci oraya koy.
    var hedef = Math.min(res[0].flat + (res[0].uzunluk || probe.length), this.range[1]);
    var atlanan = Math.abs(hedef - this.cursor);
    var from = this.cursor;
    this._dropPending();                 // konum yanlıştı, bulgular geçersiz
    this.unknown = [];
    this.streak = 0;
    this.cursor = hedef;
    this.lastAdvance = now;
    if (atlanan > 2) {
      this._emit({
        tip: 'sicrama', from: from, flat: res[0].flat, ayah: res[0].ayah,
        word: res[0].word, skor: res[0].score, t: now
      });
    }
    return true;
  };

  /** Ses var ama ilerleme yoksa "takıldı" bildirir. */
  Tracker.prototype.checkStall = function (now) {
    if (now - this.lastAdvance < this.o.stallMs) return null;
    this.lastAdvance = now;
    return {
      tip: 'takilma', flat: this.cursor, ayah: this.ix.ayahOf[this.cursor],
      word: this.ix.posOf[this.cursor], ipucu: this.hint(), t: now
    };
  };

  /** Takılana gösterilecek sonraki kelimeler. */
  Tracker.prototype.hint = function (n) {
    n = n || 2;
    var out = [];
    for (var i = 0; i < n && this.cursor + i < this.range[1]; i++) {
      out.push(this.ix.words[this.cursor + i]);
    }
    return out;
  };

  Tracker.prototype.progress = function () {
    var total = this.range[1] - this.range[0];
    return total > 0 ? Math.min(1, (this.cursor - this.range[0]) / total) : 0;
  };

  /** Oturum raporu. Bekleyen (doğrulanmamış) bulgular rapora girmez. */
  Tracker.prototype.report = function () {
    var say = { atlama: 0, yanlis: 0, tekrar: 0 };
    for (var i = 0; i < this.confirmed.length; i++) {
      var t = this.confirmed[i].tip;
      if (say[t] !== undefined) say[t]++;
    }
    var okunan = this.cursor - this.startCursor;
    var hata = say.atlama + say.yanlis;
    return {
      okunanKelime: Math.max(0, okunan),
      duyulanKelime: this.heard,
      dogru: this.correct,
      hatalar: this.confirmed.slice(),
      sayim: say,
      isabet: okunan > 0 ? Math.max(0, Math.min(1, (okunan - hata) / okunan)) : 0
    };
  };

  /* ==================================================================
   * 4. Ezber tekrarı (SM-2 türevi)
   * ------------------------------------------------------------------
   * Birim = mushaf sayfası ya da seçilen ayet aralığı. Okuma isabeti
   * doğrudan nota çevrilir, not da bir sonraki tekrar gününü belirler.
   * ================================================================== */
  function isabetNotu(isabet) {
    if (isabet >= 0.97) return 5;
    if (isabet >= 0.92) return 4;
    if (isabet >= 0.82) return 3;
    if (isabet >= 0.65) return 2;
    if (isabet >= 0.4) return 1;
    return 0;
  }

  function srsIlerlet(state, not, now) {
    var s = Object.assign({ kolaylik: 2.5, aralik: 0, tekrar: 0, hata: 0 }, state || {});
    now = now || Date.now();
    if (not < 3) {
      s.tekrar = 0;
      s.aralik = 1;
      s.hata = (s.hata || 0) + 1;
    } else {
      if (s.tekrar === 0) s.aralik = 1;
      else if (s.tekrar === 1) s.aralik = 3;
      else s.aralik = Math.round(s.aralik * s.kolaylik);
      s.tekrar += 1;
    }
    s.kolaylik = Math.max(1.3, s.kolaylik + (0.1 - (5 - not) * (0.08 + (5 - not) * 0.02)));
    s.aralik = Math.min(s.aralik, 180);
    s.sonNot = not;
    s.sonCalisma = now;
    s.vade = now + s.aralik * 86400000;
    return s;
  }

  return {
    normalize: normalize,
    tokens: tokens,
    skeleton: skeleton,
    wordSim: wordSim,
    levenshtein: levenshtein,
    alignScore: alignScore,
    QuranIndex: QuranIndex,
    Tracker: Tracker,
    isabetNotu: isabetNotu,
    srsIlerlet: srsIlerlet,
    VARSAYILAN: DEFAULTS
  };
});
