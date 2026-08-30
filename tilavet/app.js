/*!
 * Tilavet — Kur'an okuma, dinleme ve ezber takibi
 *
 * Sunucu yok: metin ve meal statik JSON olarak gelir, ses tanıma tarayıcıda
 * çalışır, ilerleme localStorage'da durur. Eşleştirme mantığının tamamı
 * engine.js içindedir; bu dosya yalnız arayüz ve akıştır.
 *
 * Okuyucu, ses ve mikrofon takibi tek bir kavram üzerinden çalışır: KAPSAM.
 * Bir kapsam ya bir sûre, ya bir mushaf sayfası, ya da seçilmiş bir ayet
 * aralığıdır. Üçü de aynı kod yolunu kullanır; böylece "sayfayı ezberle" ile
 * "şu üç ayeti tekrar et" ayrı birer özellik olmak zorunda kalmaz.
 */
(function () {
  'use strict';
  var T = window.Tilavet;

  /* ================= yardımcılar ================= */
  function el(etiket, ozellik) {
    var d = document.createElement(etiket);
    if (ozellik) {
      for (var k in ozellik) {
        if (k === 'sinif') d.className = ozellik[k];
        else if (k === 'metin') d.textContent = ozellik[k];
        else if (k === 'html') d.innerHTML = ozellik[k];
        else if (k.slice(0, 2) === 'on') d.addEventListener(k.slice(2), ozellik[k]);
        else if (ozellik[k] !== null && ozellik[k] !== undefined && ozellik[k] !== false) d.setAttribute(k, ozellik[k]);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) d.appendChild(x); });
      else d.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return d;
  }
  function $(s, k) { return (k || document).querySelector(s); }
  function hepsi(s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); }
  function pad3(n) { return ('00' + n).slice(-3); }
  function bugunKod(t) { var d = t ? new Date(t) : new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function sayi(n) { return (n || 0).toLocaleString('tr-TR'); }
  /** Ayet sonu madalyonu: ۝ işareti Arap rakamlarını içine alır. */
  function arapRakam(n) {
    return String(n).replace(/[0-9]/g, function (d) { return String.fromCharCode(0x0660 + (+d)); });
  }

  var bildirimZaman = null;
  function bildir(metin) {
    var eski = $('.bildirim'); if (eski) eski.remove();
    var b = el('div', { sinif: 'bildirim', metin: metin });
    document.body.appendChild(b);
    clearTimeout(bildirimZaman);
    bildirimZaman = setTimeout(function () { b.remove(); }, 2600);
  }

  /* ================= kalıcı durum ================= */
  var ANAHTAR = 'tilavet.v1';
  var VARSAYILAN = {
    ayar: {
      kari: 'Alafasy_128kbps', hatBoyu: 1.75, meal: false, okunus: false,
      tema: 'koyu', tanimaDili: 'ar-SA', otoKaydir: true, sesliIpucu: true
    },
    sonKonum: null,            // {s, a}
    yerImleri: [],             // ["2:255", ...]
    gunluk: {},                // {"2026-08-30": {dakika, ayet, kelime, hata}}
    ezber: {},                 // {"sure:67": {...srs}}
    oturumlar: []              // son 40 takip oturumu
  };
  var D = (function () {
    try {
      var ham = JSON.parse(localStorage.getItem(ANAHTAR) || '{}');
      var d = Object.assign({}, VARSAYILAN, ham);
      d.ayar = Object.assign({}, VARSAYILAN.ayar, ham.ayar || {});
      // Okuma yüzeyi sadeleşti: meal ve okunuş artık ayete yapışık değil,
      // ayete dokununca çıkıyor. Eski kurulumlarda bir kez kapatılır.
      if (d.ayarSurum !== 2) { d.ayar.meal = false; d.ayar.okunus = false; d.ayarSurum = 2; }
      return d;
    } catch (e) { return JSON.parse(JSON.stringify(VARSAYILAN)); }
  })();
  function kaydet() {
    try { localStorage.setItem(ANAHTAR, JSON.stringify(D)); }
    catch (e) { /* kota dolduysa sessizce geç */ }
  }
  function gunKaydi(kod) {
    kod = kod || bugunKod();
    if (!D.gunluk[kod]) D.gunluk[kod] = { dakika: 0, ayet: 0, kelime: 0, hata: 0 };
    return D.gunluk[kod];
  }
  function seriHesapla() {
    var seri = 0, g = new Date();
    for (;;) {
      var k = bugunKod(g.getTime());
      var v = D.gunluk[k];
      if (v && (v.kelime > 0 || v.ayet > 0)) seri++;
      else if (seri > 0 || k !== bugunKod()) break;
      g.setDate(g.getDate() - 1);
      if (seri > 3650) break;
    }
    return seri;
  }

  /* ================= veri ================= */
  var META = null, MATCH = null, IX = null;
  var sureOnbellek = new Map();

  function getJSON(yol) {
    return fetch(yol, { cache: 'default' }).then(function (r) {
      if (!r.ok) throw new Error(yol + ' yüklenemedi (' + r.status + ')');
      return r.json();
    });
  }
  function sureGetir(n) {
    if (sureOnbellek.has(n)) return Promise.resolve(sureOnbellek.get(n));
    return getJSON('data/text/' + pad3(n) + '.json').then(function (d) {
      sureOnbellek.set(n, d); return d;
    });
  }
  /** Eşleştirme metni ve dizin yalnız gerektiğinde (mikrofon) yüklenir. */
  var dizinSozu = null;
  function dizinGetir() {
    if (dizinSozu) return dizinSozu;
    dizinSozu = getJSON('data/match.json').then(function (m) {
      MATCH = m; IX = new T.QuranIndex(m); return IX;
    });
    return dizinSozu;
  }

  function sureBilgi(n) { return META.sure[n - 1]; }
  function ayetDizini(s, a) { return META.sure[s - 1].ofset + (a - 1); }
  function dizindenKonum(idx) {
    for (var i = 0; i < META.sure.length; i++) {
      var s = META.sure[i];
      if (idx < s.ofset + s.ayet) return { s: s.n, a: idx - s.ofset + 1 };
    }
    return { s: 114, a: 6 };
  }
  function ayetSayfasi(s, a) {
    var son = 1;
    for (var i = 0; i < META.sayfa.length; i++) {
      var p = META.sayfa[i];
      if (p.s < s || (p.s === s && p.a <= a)) son = p.n; else break;
    }
    return son;
  }
  function ayetCuzu(s, a) {
    var son = 1;
    for (var i = 0; i < META.cuz.length; i++) {
      var c = META.cuz[i];
      if (c.s < s || (c.s === s && c.a <= a)) son = c.n; else break;
    }
    return son;
  }
  /** Bir mushaf sayfasının ilk ve son ayetinin genel sırası. */
  function sayfaSiniri(p) {
    var bas = META.sayfa[p - 1];
    var basIdx = ayetDizini(bas.s, bas.a);
    var sonIdx = p < META.sayfa.length
      ? ayetDizini(META.sayfa[p].s, META.sayfa[p].a) - 1
      : META.toplamAyet - 1;
    return [basIdx, sonIdx];
  }

  /* ================= kapsam ================= */
  /* {tur:'sure', s} | {tur:'sayfa', p} | {tur:'aralik', ilk, son}
     Aralık, sûre+ayet yerine genel ayet sırasıyla tutulur; böylece iki sûreye
     taşan bir mushaf sayfasından da aralık seçilebilir. */

  function kapsamAnahtar(k) {
    if (k.tur === 'sure') return 'sure:' + k.s;
    if (k.tur === 'sayfa') return 'sayfa:' + k.p;
    return 'aralik:' + k.ilk + ':' + k.son;
  }
  function anahtardanKapsam(a) {
    var p = a.split(':');
    if (p[0] === 'sure') return { tur: 'sure', s: +p[1] };
    if (p[0] === 'sayfa') return { tur: 'sayfa', p: +p[1] };
    return { tur: 'aralik', ilk: +p[1], son: +p[2] };
  }
  function kapsamAdi(k) {
    if (k.tur === 'sure') return sureBilgi(k.s).ad + ' sûresi';
    if (k.tur === 'sayfa') return k.p + '. sayfa';
    var a = dizindenKonum(k.ilk), b = dizindenKonum(k.son);
    return a.s === b.s
      ? sureBilgi(a.s).ad + ' ' + a.a + (a.a === b.a ? '' : '–' + b.a)
      : sureBilgi(a.s).ad + ' ' + a.a + ' – ' + sureBilgi(b.s).ad + ' ' + b.a;
  }
  /** Kapsamın kapsadığı ayetlerin genel sıra aralığı [ilk, son]. */
  function kapsamSinir(k) {
    if (k.tur === 'sure') {
      var s = sureBilgi(k.s);
      return [s.ofset, s.ofset + s.ayet - 1];
    }
    if (k.tur === 'sayfa') return sayfaSiniri(k.p);
    return [k.ilk, k.son];
  }
  /** Takip için kelime düzeyinde aralık; dizin yüklenmiş olmalı. */
  function kapsamKelimeAralik(k) {
    var s = kapsamSinir(k);
    return [IX.ayahStart[s[0]], IX.ayahEnd(s[1])];
  }
  function kapsamIlkAyet(k) {
    return dizindenKonum(kapsamSinir(k)[0]);
  }
  /** Kapsamdaki ayetleri metinleriyle getirir; sayfa iki sûreye taşabilir. */
  function kapsamAyetleri(k) {
    var sinir = kapsamSinir(k);
    var ilk = dizindenKonum(sinir[0]), son = dizindenKonum(sinir[1]);
    var sureler = [];
    for (var n = ilk.s; n <= son.s; n++) sureler.push(n);
    return Promise.all(sureler.map(sureGetir)).then(function (dosyalar) {
      var liste = [];
      dosyalar.forEach(function (d, i) {
        var no = sureler[i];
        var bas = no === ilk.s ? ilk.a : 1;
        var bit = no === son.s ? son.a : sureBilgi(no).ayet;
        for (var a = bas; a <= bit; a++) {
          var ayet = d.ayetler[a - 1];
          liste.push({ s: no, a: a, u: ayet.u, m: ayet.m, l: ayet.l });
        }
      });
      return liste;
    });
  }

  /* ================= kâriler ================= */
  var KARILER = [
    { id: 'Alafasy_128kbps', ad: 'Mişârî Râşid el-Afâsî' },
    { id: 'Husary_128kbps', ad: 'Mahmûd Halîl el-Husarî' },
    { id: 'Husary_Mujawwad_64kbps', ad: 'el-Husarî (Mücevved)' },
    { id: 'Abdul_Basit_Murattal_192kbps', ad: 'Abdulbâsit (Murattal)' },
    { id: 'Minshawy_Murattal_128kbps', ad: 'Muhammed Sıddîk el-Minşâvî' },
    { id: 'Ghamadi_40kbps', ad: 'Sa\'d el-Gâmidî' },
    { id: 'Abdurrahmaan_As-Sudais_192kbps', ad: 'Abdurrahmân es-Sudeys' }
  ];
  function sesUrl(s, a) {
    return 'https://everyayah.com/data/' + D.ayar.kari + '/' + pad3(s) + pad3(a) + '.mp3';
  }

  /* ================= gezinme ================= */
  var gorunum = { ad: 'bugun' };
  var gecmis = [];

  function git(g, gecmiseEkle) {
    if (gecmiseEkle !== false && gorunum) gecmis.push(gorunum);
    gorunum = g;
    ciz();
  }
  function geriGit() {
    if (gecmis.length) { gorunum = gecmis.pop(); ciz(); }
    else { gorunum = { ad: 'bugun' }; gecmis = []; ciz(); }
  }

  var CIZERLER = {};
  function ciz() {
    var kap = $('#ekran');
    takipDurdurSessiz();
    sesDurdur();
    fabKaldir();
    ayetSecimiTemizle();
    kap.innerHTML = '';
    var f = CIZERLER[gorunum.ad] || CIZERLER.bugun;
    kap.appendChild(f(gorunum));
    kap.scrollTop = 0;

    var kokEkran = ['bugun', 'kuran', 'ezber', 'istatistik'].indexOf(gorunum.ad) >= 0;
    kap.classList.toggle('okuma', gorunum.ad === 'okuyucu');
    $('#menu-ac').hidden = gorunum.ad !== 'okuyucu';
    $('#geri').hidden = kokEkran;
    $('#marka').hidden = !kokEkran;
    $('#serit').hidden = !kokEkran && ['ayarlar', 'rapor'].indexOf(gorunum.ad) < 0;
    hepsi('#serit button').forEach(function (b) {
      b.setAttribute('aria-selected', b.dataset.sekme === gorunum.ad ? 'true' : 'false');
    });
  }

  /* ================= ekran: Bugün ================= */
  CIZERLER.bugun = function () {
    $('#baslik').textContent = 'Tilavet';
    var k = el('section');
    var seri = seriHesapla();
    var g = gunKaydi();
    var hedef = 10;                                   // günlük hedef: 10 dakika
    var oran = Math.min(1, g.dakika / hedef);

    k.appendChild(el('div', { sinif: 'kart seri-kart' },
      halka(oran, seri),
      el('div', { sinif: 'buyu' },
        el('div', { sinif: 'kucuk silik', metin: seri > 0 ? seri + ' gündür aralıksız' : 'Bugün başla' }),
        el('div', { metin: Math.round(g.dakika) + ' dk okundu', style: 'font-size:1.15rem;font-weight:750;margin:3px 0' }),
        el('div', { sinif: 'minik silik', metin: sayi(g.kelime) + ' kelime · ' + sayi(g.ayet) + ' ayet' })
      )
    ));

    if (D.sonKonum) {
      var s = sureBilgi(D.sonKonum.s);
      k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Kaldığın yer' }));
      k.appendChild(el('button', {
        sinif: 'oge', onclick: function () { okuyucuAc({ tur: 'sure', s: D.sonKonum.s }, D.sonKonum.a); }
      },
        el('div', { sinif: 'no' }, el('span', { metin: String(s.n) })),
        el('div', { sinif: 'gövde' },
          el('div', { sinif: 'ad', metin: s.ad + ' sûresi' }),
          el('div', { sinif: 'alt', metin: D.sonKonum.a + '. ayet · ' + ayetSayfasi(D.sonKonum.s, D.sonKonum.a) + '. sayfa' })),
        el('div', { sinif: 'sag', metin: 'Devam ›' })
      ));
    }

    var vadesi = ezberVadesiGelenler();
    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Bugünün tekrarı' }));
    if (!vadesi.length) {
      k.appendChild(el('div', { sinif: 'kart kucuk silik' },
        Object.keys(D.ezber).length
          ? 'Bugün tekrarı gelen bir bölüm yok. Ne güzel.'
          : 'Henüz ezber bölümü eklemedin. Bir sûre ya da sayfa açıp “Ezbere ekle” de.'));
    } else {
      k.appendChild(el('div', { sinif: 'liste' }, vadesi.slice(0, 4).map(function (a) { return ezberOgesi(a); })));
    }

    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Günün ayeti' }));
    var kart = el('div', { sinif: 'kart' }, el('div', { sinif: 'kucuk silik', metin: 'yükleniyor…' }));
    k.appendChild(kart);
    gununAyeti(kart);
    return k;
  };

  function halka(oran, orta) {
    var r = 34, c = 2 * Math.PI * r;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '84'); svg.setAttribute('height', '84'); svg.setAttribute('viewBox', '0 0 84 84');
    svg.innerHTML =
      '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="7"/>' +
      '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="var(--altin)" stroke-width="7" stroke-linecap="round" ' +
      'stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - oran)) + '"/>';
    return el('div', { sinif: 'halka' }, svg, el('div', { sinif: 'orta', metin: String(orta) }));
  }

  function gununAyeti(kart) {
    var gun = Math.floor(Date.now() / 86400000);
    var yer = dizindenKonum((gun * 7919) % META.toplamAyet);
    sureGetir(yer.s).then(function (d) {
      var ayet = d.ayetler[yer.a - 1];
      kart.innerHTML = '';
      kart.appendChild(el('div', { sinif: 'ayet-vitrin', metin: ayet.u }));
      if (D.ayar.meal) kart.appendChild(el('div', { sinif: 'meal', metin: ayet.m }));
      kart.appendChild(el('div', { sinif: 'satir', style: 'margin-top:12px' },
        el('div', { sinif: 'minik silik buyu', metin: sureBilgi(yer.s).ad + ' ' + yer.s + ':' + yer.a }),
        el('button', { sinif: 'dugme ince', metin: 'Aç', onclick: function () { okuyucuAc({ tur: 'sure', s: yer.s }, yer.a); } })
      ));
    }).catch(function () { kart.textContent = 'Ayet yüklenemedi.'; });
  }

  /* ================= ekran: Kur'an ================= */
  var kuranSekme = 'sure';
  CIZERLER.kuran = function () {
    $('#baslik').textContent = 'Kur\'an-ı Kerim';
    var k = el('section');
    var sekmeler = el('div', { sinif: 'sekmeler' });
    [['sure', 'Sûre'], ['cuz', 'Cüz'], ['sayfa', 'Sayfa']].forEach(function (p) {
      sekmeler.appendChild(el('button', {
        'aria-selected': kuranSekme === p[0] ? 'true' : 'false', metin: p[1],
        onclick: function () { kuranSekme = p[0]; ciz(); }
      }));
    });
    k.appendChild(sekmeler);

    var liste = el('div', { sinif: 'liste' });
    if (kuranSekme === 'sure') {
      var arama = el('input', { sinif: 'arama', type: 'search', placeholder: 'Sûre adı veya numarası…' });
      arama.addEventListener('input', function () { sureListesi(liste, arama.value); });
      k.appendChild(arama);
      sureListesi(liste, '');
    } else if (kuranSekme === 'cuz') {
      META.cuz.forEach(function (c) {
        var s = sureBilgi(c.s);
        liste.appendChild(el('button', {
          sinif: 'oge', onclick: function () { okuyucuAc({ tur: 'sure', s: c.s }, c.a); }
        },
          el('div', { sinif: 'no' }, el('span', { metin: String(c.n) })),
          el('div', { sinif: 'gövde' },
            el('div', { sinif: 'ad', metin: c.n + '. Cüz' }),
            el('div', { sinif: 'alt', metin: s.ad + ' ' + c.a + '. ayetten başlar' })),
          el('div', { sinif: 'sag', metin: ayetSayfasi(c.s, c.a) + '. sayfa' })
        ));
      });
    } else {
      var sayfaAra = el('input', { sinif: 'arama', type: 'number', min: 1, max: META.sayfa.length, placeholder: 'Sayfa numarası (1–' + META.sayfa.length + ')' });
      sayfaAra.addEventListener('input', function () { sayfaListesi(liste, sayfaAra.value); });
      k.appendChild(sayfaAra);
      sayfaListesi(liste, '');
    }
    k.appendChild(liste);
    return k;
  };

  function sadeAd(x) {
    return x.toLocaleLowerCase('tr')
      .replace(/[âàáä]/g, 'a').replace(/[îíì]/g, 'i').replace(/[ûüù]/g, 'u')
      .replace(/[ôö]/g, 'o').replace(/[şŝ]/g, 's').replace(/[ğ]/g, 'g').replace(/[ç]/g, 'c');
  }
  function sureListesi(kap, sorgu) {
    kap.innerHTML = '';
    var q = sadeAd((sorgu || '').trim());
    META.sure.forEach(function (s) {
      if (q && sadeAd(s.ad).indexOf(q) < 0 && String(s.n).indexOf(q) !== 0 && sadeAd(s.anlam).indexOf(q) < 0) return;
      kap.appendChild(el('button', {
        sinif: 'oge', onclick: function () { okuyucuAc({ tur: 'sure', s: s.n }, 1); }
      },
        el('div', { sinif: 'no' }, el('span', { metin: String(s.n) })),
        el('div', { sinif: 'gövde' },
          el('div', { sinif: 'ad', metin: s.ad }),
          el('div', { sinif: 'alt', metin: s.anlam + ' · ' + s.ayet + ' ayet · ' + s.inis })),
        el('div', { sinif: 'ar', metin: s.ar })
      ));
    });
    if (!kap.children.length) kap.appendChild(el('div', { sinif: 'bos', metin: 'Sûre bulunamadı.' }));
  }

  function sayfaListesi(kap, sorgu) {
    kap.innerHTML = '';
    var n = parseInt(sorgu, 10);
    var liste = META.sayfa;
    if (n >= 1 && n <= META.sayfa.length) liste = liste.slice(n - 1, Math.min(META.sayfa.length, n + 9));
    liste.slice(0, 120).forEach(function (p) {
      var s = sureBilgi(p.s);
      kap.appendChild(el('button', {
        sinif: 'oge', onclick: function () { okuyucuAc({ tur: 'sayfa', p: p.n }); }
      },
        el('div', { sinif: 'no' }, el('span', { metin: String(p.n) })),
        el('div', { sinif: 'gövde' },
          el('div', { sinif: 'ad', metin: p.n + '. sayfa' }),
          el('div', { sinif: 'alt', metin: s.ad + ' ' + p.a + '. ayet · ' + ayetCuzu(p.s, p.a) + '. cüz' })),
        el('div', { sinif: 'sag', metin: '۩' })
      ));
    });
  }

  /* ================= ekran: Ayarlar ================= */
  CIZERLER.ayarlar = function () {
    $('#baslik').textContent = 'Ayarlar';
    var k = el('section');

    function secim(baslik, secenekler, deger, degisti) {
      var s = el('select');
      secenekler.forEach(function (o) {
        s.appendChild(el('option', { value: o[0], metin: o[1], selected: o[0] === deger ? 'selected' : null }));
      });
      s.addEventListener('change', function () { degisti(s.value); });
      return el('div', { sinif: 'ayar' }, el('div', { sinif: 'buyu', metin: baslik }), s);
    }
    function anahtar(baslik, alt, deger, degisti) {
      var d = el('button', { sinif: 'anahtar', 'aria-checked': deger ? 'true' : 'false', 'aria-label': baslik });
      d.addEventListener('click', function () {
        deger = !deger; d.setAttribute('aria-checked', deger ? 'true' : 'false'); degisti(deger);
      });
      return el('div', { sinif: 'ayar' },
        el('div', { sinif: 'buyu' }, el('div', { metin: baslik }), alt ? el('div', { sinif: 'minik silik', metin: alt }) : null), d);
    }

    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Okuma' }));
    var kart = el('div', { sinif: 'kart' });
    var boy = el('input', { type: 'range', min: '1.2', max: '3', step: '0.05', value: String(D.ayar.hatBoyu) });
    boy.addEventListener('input', function () {
      D.ayar.hatBoyu = parseFloat(boy.value);
      document.documentElement.style.setProperty('--hat-boy', D.ayar.hatBoyu + 'rem'); kaydet();
    });
    kart.appendChild(el('div', { sinif: 'ayar' }, el('div', { sinif: 'buyu', metin: 'Hat boyu' }), boy));
    kart.appendChild(el('div', { sinif: 'hat', style: 'padding:6px 0 2px', metin: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ' }));
    kart.appendChild(anahtar('Meali göster', null, D.ayar.meal, function (v) { D.ayar.meal = v; kaydet(); }));
    kart.appendChild(anahtar('Latin okunuşu göster', 'Arapça okumayı bilmeyenler için', D.ayar.okunus, function (v) { D.ayar.okunus = v; kaydet(); }));
    kart.appendChild(secim('Tema', [['koyu', 'Koyu'], ['acik', 'Açık']], D.ayar.tema, function (v) {
      D.ayar.tema = v; document.documentElement.dataset.tema = v; kaydet();
    }));
    k.appendChild(kart);

    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Ses' }));
    var kart2 = el('div', { sinif: 'kart' });
    kart2.appendChild(secim('Kâri', KARILER.map(function (x) { return [x.id, x.ad]; }), D.ayar.kari, function (v) {
      D.ayar.kari = v; kaydet(); bildir('Kâri değişti');
    }));
    kart2.appendChild(el('div', { sinif: 'minik silik', metin: 'Ses kayıtları everyayah.com üzerinden akar; çevrimdışıyken çalmaz.' }));
    k.appendChild(kart2);

    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Mikrofonla takip' }));
    var kart3 = el('div', { sinif: 'kart' });
    kart3.appendChild(secim('Tanıma dili', [['ar-SA', 'Arapça (Suudi Arabistan)'], ['ar-EG', 'Arapça (Mısır)'], ['ar-JO', 'Arapça (Ürdün)']],
      D.ayar.tanimaDili, function (v) { D.ayar.tanimaDili = v; kaydet(); }));
    kart3.appendChild(anahtar('Okurken kendiliğinden kaydır', null, D.ayar.otoKaydir, function (v) { D.ayar.otoKaydir = v; kaydet(); }));
    kart3.appendChild(anahtar('Takılınca ipucu ver', 'Dört saniye ilerleme olmazsa sonraki kelimeyi gösterir', D.ayar.sesliIpucu,
      function (v) { D.ayar.sesliIpucu = v; kaydet(); }));
    kart3.appendChild(el('div', { sinif: 'minik silik', style: 'margin-top:8px', metin: 'Ses tanıma tarayıcının kendi hizmetiyle çalışır ve internet ister. Kaydınız bu uygulamada saklanmaz.' }));
    k.appendChild(kart3);

    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Veri' }));
    var kart4 = el('div', { sinif: 'kart' });
    kart4.appendChild(el('div', { sinif: 'kucuk silik', style: 'margin-bottom:10px', metin: 'İlerleme, ezber planı ve yer imleri yalnız bu cihazda tutulur.' }));
    kart4.appendChild(el('button', {
      sinif: 'dugme', metin: 'Tüm verimi sil',
      onclick: function () {
        if (!confirm('İlerlemen, ezber planın ve yer imlerin silinecek. Emin misin?')) return;
        localStorage.removeItem(ANAHTAR);
        D = JSON.parse(JSON.stringify(VARSAYILAN));
        bildir('Veriler silindi'); git({ ad: 'bugun' }, false);
      }
    }));
    k.appendChild(kart4);
    k.appendChild(el('div', { sinif: 'minik silik', style: 'text-align:center;padding:18px 0' },
      el('div', { metin: 'Metin: Kral Fahd Kur\'an Basım Kompleksi (Osmanî Hafs)' }),
      el('div', { metin: 'Meal: Diyanet Vakfı' }),
      el('div', { metin: 'Hat: Amiri Quran (SIL OFL)' })));
    return k;
  };

  /* ================= ses: kuyruk ve tekrar döngüsü ================= */
  /* Kâri sesi tek ayet değil bir kuyruk çalar; kuyruk bitince baştan
     dönebilir. Ezber tekrarının ("şu üç ayeti beş kez dinle") tamamı bu. */
  var ses = { calgi: null, kuyruk: [], indis: 0, tur: 0, hedef: 1, aktif: false };

  function calgi() {
    if (!ses.calgi) {
      ses.calgi = new Audio();
      ses.calgi.addEventListener('ended', function () {
        if (!ses.aktif) return;
        ses.indis++;
        if (ses.indis < ses.kuyruk.length) return sesSonraki();
        ses.tur++;
        if (ses.hedef === 0 || ses.tur < ses.hedef) { ses.indis = 0; return sesSonraki(); }
        sesDurdur();
        bildir('Okuma bitti');
      });
      ses.calgi.addEventListener('error', function () {
        if (ses.aktif) { sesDurdur(); bildir('Ses yüklenemedi — bağlantını kontrol et'); }
      });
    }
    return ses.calgi;
  }
  function sesSonraki() {
    var y = ses.kuyruk[ses.indis];
    if (!y) return sesDurdur();
    var c = calgi();
    c.src = sesUrl(y.s, y.a);
    c.play().catch(function () { bildir('Sesi başlatmak için ekrana dokun'); });
    ayetVurgu(y.s, y.a);
    ilerlemeYaz(y);
    sesDurumGuncelle();
  }
  function kuyrukCal(liste, tekrar) {
    if (!liste.length) return;
    ses.kuyruk = liste; ses.indis = 0; ses.tur = 0;
    ses.hedef = tekrar === undefined ? 1 : tekrar;
    ses.aktif = true;
    sesSonraki();
  }
  function sesDurdur() {
    if (ses.calgi) { ses.calgi.pause(); ses.calgi.removeAttribute('src'); }
    ses.aktif = false; ses.kuyruk = []; ses.indis = 0; ses.tur = 0;
    ayetVurgu(null);
    sesDurumGuncelle();
  }
  /** Ses çalarken mikrofon düğmesinin üstünde beliren küçük şerit. */
  function sesDurumGuncelle() {
    var eski = $('.calma-pili'); if (eski) eski.remove();
    if (!ses.aktif) return;
    var y = ses.kuyruk[ses.indis];
    if (!y) return;
    var ek = ses.hedef === 0 ? ' · ∞' : (ses.hedef > 1 ? ' · ' + (ses.tur + 1) + '/' + ses.hedef : '');
    document.body.appendChild(el('div', { sinif: 'calma-pili' },
      el('span', { metin: sureBilgi(y.s).ad + ' ' + y.s + ':' + y.a + ek }),
      el('button', { metin: '■', 'aria-label': 'Dinlemeyi durdur', onclick: sesDurdur })));
  }
  function ayetVurgu(s, a) {
    hepsi('.ayet, .mushaf-ayet').forEach(function (e) {
      e.classList.toggle('etkin', s !== null && +e.dataset.s === s && +e.dataset.a === a);
    });
    if (s === null || !D.ayar.otoKaydir) return;
    var hedef = $('[data-s="' + s + '"][data-a="' + a + '"]');
    if (hedef) hedef.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ================= ekran: Okuyucu ================= */
  function ilerlemeYaz(k) { D.sonKonum = { s: k.s, a: k.a }; kaydet(); }

  function okuyucuAc(kapsam, ayetNo, ek) {
    var bas = ayetNo
      ? { s: kapsam.s || kapsamIlkAyet(kapsam).s, a: ayetNo }
      : kapsamIlkAyet(kapsam);
    git(Object.assign({ ad: 'okuyucu', kapsam: kapsam, bas: bas }, ek || {}));
  }

  var seciliAyet = null;      // mushaf düzeninde dokunulan ayet

  var okuyucuBaglam = null;      // üstteki ⋯ menüsünün ihtiyaç duyduğu bağlam

  CIZERLER.okuyucu = function (g) {
    var kapsam = g.kapsam;
    var duzen = g.duzen || 'mushaf';       // okuma yüzeyi mushaf ile başlar
    $('#baslik').textContent = kapsamAdi(kapsam) + (g.gizli ? ' · ezber' : '');
    seciliAyet = null;

    var k = el('section');
    var govde = el('div', {}, el('div', { sinif: 'yukleniyor', metin: 'Yükleniyor…' }));
    k.appendChild(govde);
    ilerlemeYaz(g.bas);

    kapsamAyetleri(kapsam).then(function (ayetler) {
      okuyucuBaglam = { g: g, kapsam: kapsam, duzen: duzen, ayetler: ayetler };
      govde.innerHTML = '';
      govde.appendChild(okuyucuBasi(g, kapsam));
      govde.appendChild(duzen === 'mushaf'
        ? mushafDuzeni(g, kapsam, ayetler)
        : listeDuzeni(g, ayetler));
      if (kapsam.tur === 'sayfa') govde.appendChild(sayfaAltligi(kapsam, ayetler));
      mikrofonDugmesi(g);

      var hedef = $('[data-s="' + g.bas.s + '"][data-a="' + g.bas.a + '"]');
      if (hedef && hedef !== govde.querySelector('.ayet, .mushaf-ayet')) {
        setTimeout(function () { hedef.scrollIntoView({ block: 'start' }); }, 30);
      }
      if (g.takip) setTimeout(function () { takipBaslat(g, kapsam); }, 120);
    }).catch(function (e) {
      govde.innerHTML = '';
      govde.appendChild(el('div', { sinif: 'bos', metin: 'Yüklenemedi: ' + e.message }));
    });
    return k;
  };

  function okuyucuBasi(g, kapsam) {
    var ilk = kapsamIlkAyet(kapsam);
    var bas = el('div', { sinif: 'okuyucu-basi' });
    if (kapsam.tur === 'sayfa') {
      bas.appendChild(el('div', { sinif: 'alt', metin: ayetCuzu(ilk.s, ilk.a) + '. cüz · ' + sureBilgi(ilk.s).ad }));
    } else {
      bas.appendChild(el('div', { sinif: 'ad-ar', metin: sureBilgi(ilk.s).ar }));
      var s = sureBilgi(ilk.s);
      bas.appendChild(el('div', {
        sinif: 'alt',
        metin: kapsam.tur === 'aralik'
          ? (kapsam.son - kapsam.ilk + 1) + ' ayet · ' + ayetSayfasi(ilk.s, ilk.a) + '. sayfa'
          : s.anlam + ' · ' + s.ayet + ' ayet · ' + s.inis
      }));
    }
    if (kapsam.tur !== 'sayfa') return bas;

    var oklar = el('div', { sinif: 'sayfa-oklar' },
      el('button', {
        'aria-label': 'Önceki sayfa', metin: '‹', disabled: kapsam.p <= 1 ? 'disabled' : null,
        onclick: function () { okuyucuAc({ tur: 'sayfa', p: kapsam.p - 1 }); }
      }),
      el('div', { sinif: 'orta', metin: kapsam.p + ' / ' + META.sayfa.length }),
      el('button', {
        'aria-label': 'Sonraki sayfa', metin: '›', disabled: kapsam.p >= META.sayfa.length ? 'disabled' : null,
        onclick: function () { okuyucuAc({ tur: 'sayfa', p: kapsam.p + 1 }); }
      }));
    return el('div', {}, oklar, bas);
  }

  var MIK_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/>' +
    '<line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
  var DUR_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';

  /** Ekranın altındaki tek düğme. Takip sürerken durdurma düğmesine döner. */
  function mikrofonDugmesi(g) {
    var eski = $('.mik-fab'); if (eski) eski.remove();
    var mikrofonVar = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    var fab = el('button', {
      sinif: 'mik-fab', id: 'mik-fab', html: MIK_SVG,
      'aria-label': 'Mikrofonla oku', disabled: mikrofonVar ? null : 'disabled',
      onclick: function () {
        if (!mikrofonVar) { bildir('Bu tarayıcı canlı ses tanımayı desteklemiyor'); return; }
        if (takip) { takip.bitir(); return; }
        git(Object.assign({}, okuyucuBaglam.g, { takip: true, duzen: okuyucuBaglam.duzen }));
      }
    });
    document.body.appendChild(el('div', { sinif: 'okuma-perde' }));
    document.body.appendChild(fab);
    return fab;
  }
  function fabDurum(dinliyor) {
    var f = $('.mik-fab');
    if (!f) return;
    f.dataset.durum = dinliyor ? 'dinliyor' : '';
    f.innerHTML = dinliyor ? DUR_SVG : MIK_SVG;
    f.setAttribute('aria-label', dinliyor ? 'Okumayı bitir' : 'Mikrofonla oku');
  }
  function fabKaldir() {
    var f = $('.mik-fab'); if (f) f.remove();
    var p = $('.okuma-perde'); if (p) p.remove();
  }

  /* --- üstteki ⋯ menüsü: okuma dışındaki her şey burada --- */
  function okuyucuMenusu() {
    if (!okuyucuBaglam) return;
    var b = okuyucuBaglam, eski = $('.tabaka'); if (eski) eski.remove();
    function oge(im, ad, sag, tikla) {
      return el('button', { sinif: 'menu-oge', onclick: function () { tabaka.remove(); tikla(); } },
        el('span', { sinif: 'im', metin: im }), el('span', { metin: ad }),
        sag ? el('span', { sinif: 'sag', metin: sag }) : null);
    }
    var tabaka = el('div', { sinif: 'tabaka', onclick: function (e) { if (e.target === tabaka) tabaka.remove(); } },
      el('div', { sinif: 'sayfa-alt-tabaka' },
        el('div', { sinif: 'tutamak' }),
        oge('▷', ses.aktif ? 'Dinlemeyi durdur' : 'Baştan dinle', KARILER.filter(function (x) { return x.id === D.ayar.kari; })[0].ad,
          function () {
            if (ses.aktif) sesDurdur();
            else kuyrukCal(b.ayetler.map(function (x) { return { s: x.s, a: x.a }; }), 1);
          }),
        oge('⟲', 'Aralık ve tekrar', null, function () { aralikPaneli(b.g, b.kapsam, b.ayetler); }),
        oge('✦', 'Ezbere ekle', kapsamAdi(b.kapsam), function () { ezberEkle(b.kapsam); }),
        oge('۩', b.duzen === 'mushaf' ? 'Ayet ayet göster' : 'Mushaf düzenine geç', null,
          function () { git(Object.assign({}, b.g, { duzen: b.duzen === 'mushaf' ? 'liste' : 'mushaf' }), false); }),
        oge('¶', D.ayar.meal ? 'Meali gizle' : 'Meali göster', 'Diyanet Vakfı',
          function () { D.ayar.meal = !D.ayar.meal; kaydet(); git(Object.assign({}, b.g, { duzen: b.duzen }), false); }),
        b.kapsam.tur === 'sure' && b.kapsam.s < 114
          ? oge('↓', 'Sonraki sûre', sureBilgi(b.kapsam.s + 1).ad, function () { okuyucuAc({ tur: 'sure', s: b.kapsam.s + 1 }, 1); })
          : null
      ));
    document.body.appendChild(tabaka);
  }

  function besmeleGerekli(s, a) { return a === 1 && s !== 1 && s !== 9; }

  /* --- düzen 1: ayet ayet (meal ve araçlarla) --- */
  function listeDuzeni(g, ayetler) {
    var kap = el('div');
    var oncekiSure = null;
    ayetler.forEach(function (ayet) {
      if (ayet.s !== oncekiSure) {
        oncekiSure = ayet.s;
        if (g.kapsam.tur === 'sayfa') kap.appendChild(sureAyraci(ayet.s));
        if (besmeleGerekli(ayet.s, ayet.a)) {
          kap.appendChild(el('div', { sinif: 'besmele', metin: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ' }));
        }
      } else if (besmeleGerekli(ayet.s, ayet.a)) {
        kap.appendChild(el('div', { sinif: 'besmele', metin: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ' }));
      }
      kap.appendChild(ayetKutusu(g, ayet));
    });
    return kap;
  }

  function sureAyraci(s) {
    var b = sureBilgi(s);
    return el('div', { sinif: 'sure-ayrac' },
      el('span', { sinif: 'ar', metin: b.ar }),
      el('span', { sinif: 'tr', metin: b.ad + ' sûresi' }));
  }

  function kelimeler(g, ayet) {
    var par = document.createDocumentFragment();
    ayet.u.split(' ').forEach(function (kelime, i) {
      par.appendChild(el('span', {
        sinif: 'k' + (g.gizli ? ' gizli' : ''),
        'data-s': ayet.s, 'data-a': ayet.a, 'data-w': i, metin: kelime
      }));
      par.appendChild(document.createTextNode(' '));
    });
    return par;
  }

  function ayetKutusu(g, ayet) {
    var kutu = el('div', { sinif: 'ayet', 'data-s': ayet.s, 'data-a': ayet.a });
    kutu.appendChild(el('div', { sinif: 'ayet-ust' },
      el('span', { sinif: 'ayet-no', metin: ayet.s + ':' + ayet.a })));

    var hat = el('div', { sinif: 'hat' });
    if (g.gizli) hat.dataset.gizli = '1';
    hat.appendChild(kelimeler(g, ayet));
    kutu.appendChild(hat);

    // Meal ve okunuş okuma yüzeyine yapışmaz; ayarla açılabilir ya da
    // ayete dokununca çıkan çubuktan görülür.
    if (D.ayar.okunus && !g.gizli) kutu.appendChild(el('div', { sinif: 'okunus', metin: ayet.l }));
    if (D.ayar.meal && !g.gizli) kutu.appendChild(el('div', { sinif: 'meal', metin: ayet.m }));

    kutu.addEventListener('click', function () { ayetSec(g, ayet); });
    return kutu;
  }

  /* --- düzen 2: mushaf (sürekli, iki yana yaslı hat) ---
     Sayfa sınırları basılı mushafla birebir aynıdır; satır kırılımları
     değildir — satır düzeyinde mushaf verisi çevrimdışı bir kaynakta yok. */
  function mushafDuzeni(g, kapsam, ayetler) {
    var sayfa = el('div', { sinif: 'mushaf' });
    var oncekiSure = null;
    ayetler.forEach(function (ayet) {
      if (ayet.s !== oncekiSure) {
        oncekiSure = ayet.s;
        if (kapsam.tur === 'sayfa' || ayetler[0].s !== ayet.s) sayfa.appendChild(sureAyraci(ayet.s));
        if (besmeleGerekli(ayet.s, ayet.a)) {
          sayfa.appendChild(el('div', { sinif: 'besmele', metin: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ' }));
        }
      } else if (besmeleGerekli(ayet.s, ayet.a)) {
        sayfa.appendChild(el('div', { sinif: 'besmele', metin: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ' }));
      }
      var parca = el('span', { sinif: 'mushaf-ayet hat', 'data-s': ayet.s, 'data-a': ayet.a });
      if (g.gizli) parca.dataset.gizli = '1';
      parca.appendChild(kelimeler(g, ayet));
      parca.appendChild(el('span', {
        sinif: 'nisan', metin: '۝' + arapRakam(ayet.a), 'aria-label': ayet.a + '. ayet'
      }));
      parca.addEventListener('click', function () { ayetSec(g, ayet); });
      sayfa.appendChild(parca);
      sayfa.appendChild(document.createTextNode(' '));
    });
    return sayfa;
  }

  /** Mushaf düzeninde bir ayete dokununca çıkan işlem çubuğu. */
  function ayetSec(g, ayet) {
    var ayni = seciliAyet && seciliAyet.s === ayet.s && seciliAyet.a === ayet.a;
    ayetSecimiTemizle();
    if (ayni) return;                    // aynı ayete ikinci dokunuş seçimi kaldırır
    seciliAyet = { s: ayet.s, a: ayet.a };
    var parca = $('.mushaf-ayet[data-s="' + ayet.s + '"][data-a="' + ayet.a + '"]')
             || $('.ayet[data-s="' + ayet.s + '"][data-a="' + ayet.a + '"]');
    if (parca) parca.classList.add('secili');

    var anahtar = ayet.s + ':' + ayet.a;
    var cubuk = el('div', { sinif: 'ayet-islem' },
      el('div', { sinif: 'minik silik', style: 'padding:0 4px', metin: sureBilgi(ayet.s).ad + ' ' + ayet.s + ':' + ayet.a }),
      el('button', { sinif: 'dugme ince', metin: '▷ Dinle', onclick: function () { kuyrukCal([{ s: ayet.s, a: ayet.a }], 1); } }),
      el('button', {
        sinif: 'dugme ince', metin: '🎙 Buradan oku',
        onclick: function () { git(Object.assign({}, g, { bas: { s: ayet.s, a: ayet.a }, takip: true })); }
      }),
      el('button', {
        sinif: 'dugme ince', metin: D.yerImleri.indexOf(anahtar) >= 0 ? '★' : '☆',
        onclick: function (e) {
          var i = D.yerImleri.indexOf(anahtar);
          if (i >= 0) { D.yerImleri.splice(i, 1); e.target.textContent = '☆'; }
          else { D.yerImleri.push(anahtar); e.target.textContent = '★'; }
          kaydet();
        }
      }),
      el('button', { sinif: 'dugme ince', metin: 'Meal', onclick: function () { mealGoster(ayet); } }),
      el('button', { sinif: 'dugme ince kapat', metin: '✕', 'aria-label': 'Kapat', onclick: ayetSecimiTemizle })
    );
    document.body.appendChild(cubuk);
  }

  function ayetSecimiTemizle() {
    var c = $('.ayet-islem'); if (c) c.remove();
    hepsi('.secili').forEach(function (x) { x.classList.remove('secili'); });
    seciliAyet = null;
  }

  function mealGoster(ayet) {
    ayetSecimiTemizle();                 // tabaka işlem çubuğunun yerini alır
    var eski = $('.tabaka'); if (eski) eski.remove();
    var tabaka = el('div', { sinif: 'tabaka', onclick: function (e) { if (e.target === tabaka) tabaka.remove(); } },
      el('div', { sinif: 'sayfa-alt-tabaka' },
        el('div', { sinif: 'tutamak' }),
        el('div', { sinif: 'hat', style: 'margin-bottom:14px', metin: ayet.u }),
        el('div', { sinif: 'meal', metin: ayet.m }),
        D.ayar.okunus ? el('div', { sinif: 'okunus', metin: ayet.l }) : null,
        el('div', { sinif: 'minik silik', style: 'margin-top:12px', metin: sureBilgi(ayet.s).ad + ' ' + ayet.s + ':' + ayet.a })));
    document.body.appendChild(tabaka);
  }

  function sayfaAltligi(kapsam, ayetler) {
    var son = ayetler[ayetler.length - 1];
    return el('div', { sinif: 'sayfa-altlik' },
      el('span', { metin: ayetCuzu(son.s, son.a) + '. cüz' }),
      el('span', { sinif: 'sayfa-no', metin: arapRakam(kapsam.p) }),
      el('span', { metin: kapsam.p + '. sayfa' }));
  }

  /* ================= aralık ve tekrar paneli ================= */

  /** "Şu ayetten şu ayete, şu kadar kez" — hem sesle hem mikrofonla. */
  function aralikPaneli(g, kapsam, ayetler) {
    var eski = $('.tabaka'); if (eski) eski.remove();
    function ayetSecici(varsayilan) {
      var s = el('select', { sinif: 'genis' });
      ayetler.forEach(function (x, i) {
        s.appendChild(el('option', {
          value: String(i), metin: sureBilgi(x.s).ad + ' ' + x.s + ':' + x.a,
          selected: i === varsayilan ? 'selected' : null
        }));
      });
      return s;
    }
    var basIndis = 0;
    for (var i = 0; i < ayetler.length; i++) {
      if (ayetler[i].s === g.bas.s && ayetler[i].a === g.bas.a) { basIndis = i; break; }
    }
    var bas = ayetSecici(basIndis);
    var bit = ayetSecici(Math.min(ayetler.length - 1, basIndis + 2));
    var tekrar = el('select', { sinif: 'genis' });
    [[1, '1 kez'], [3, '3 kez'], [5, '5 kez'], [10, '10 kez'], [0, 'Sürekli']].forEach(function (o) {
      tekrar.appendChild(el('option', { value: String(o[0]), metin: o[1], selected: o[0] === 3 ? 'selected' : null }));
    });

    function secim() {
      var i = +bas.value, j = +bit.value;
      if (j < i) { var t = i; i = j; j = t; }
      return { i: i, j: j, dilim: ayetler.slice(i, j + 1) };
    }
    function aralikKapsami() {
      var sc = secim();
      return {
        tur: 'aralik',
        ilk: ayetDizini(sc.dilim[0].s, sc.dilim[0].a),
        son: ayetDizini(sc.dilim[sc.dilim.length - 1].s, sc.dilim[sc.dilim.length - 1].a)
      };
    }

    var tabaka = el('div', { sinif: 'tabaka', onclick: function (e) { if (e.target === tabaka) tabaka.remove(); } },
      el('div', { sinif: 'sayfa-alt-tabaka' },
        el('div', { sinif: 'tutamak' }),
        el('div', { sinif: 'kart-baslik', style: 'margin-top:0', metin: 'Aralık ve tekrar' }),
        el('div', { sinif: 'ayar' }, el('div', { sinif: 'buyu', metin: 'Başlangıç' }), bas),
        el('div', { sinif: 'ayar' }, el('div', { sinif: 'buyu', metin: 'Bitiş' }), bit),
        el('div', { sinif: 'ayar' }, el('div', { sinif: 'buyu', metin: 'Tekrar' }), tekrar),
        el('div', { sinif: 'satir', style: 'gap:8px;margin-top:14px' },
          el('button', {
            sinif: 'dugme buyu', metin: '▶ Dinle',
            onclick: function () { tabaka.remove(); kuyrukCal(secim().dilim.map(function (x) { return { s: x.s, a: x.a }; }), +tekrar.value); }
          }),
          el('button', {
            sinif: 'dugme ana buyu', metin: '🎙 Oku',
            onclick: function () { tabaka.remove(); okuyucuAc(aralikKapsami(), null, { takip: true }); }
          })),
        el('button', {
          sinif: 'dugme', style: 'margin-top:8px', metin: '✦ Bu aralığı ezbere ekle',
          onclick: function () { tabaka.remove(); ezberEkle(aralikKapsami()); }
        }),
        el('div', { sinif: 'minik silik', style: 'margin-top:10px', metin: 'Tekrar sayısı yalnız sesli dinlemede geçerlidir; mikrofonla okurken aralık bitince oturum kapanır.' })
      ));
    document.body.appendChild(tabaka);
  }

  /* ================= canlı takip ================= */
  var takip = null;

  function takipDurdurSessiz() {
    if (!takip) return;
    try { takip.tanima.stop(); } catch (e) {}
    takip.tanima.onend = null;
    clearInterval(takip.saat);
    takip = null;
  }

  function kelimeOgesi(s, a, w) {
    return $('.k[data-s="' + s + '"][data-a="' + a + '"][data-w="' + w + '"]');
  }

  function takipBaslat(g, kapsam) {
    var Tanima = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Tanima) { bildir('Ses tanıma desteklenmiyor'); return; }

    var tepe = el('div', { sinif: 'takip-tepe' });
    var nabiz = el('i', { sinif: 'nabiz' });
    var durumMetin = el('div', { sinif: 'kucuk buyu', metin: 'Dizin hazırlanıyor…' });
    var olcekIc = el('i', { style: 'width:0%' });
    tepe.appendChild(el('div', { sinif: 'durum' }, nabiz, durumMetin));
    tepe.appendChild(el('div', { sinif: 'olcek' }, olcekIc));
    var ipucuKutu = el('div', { sinif: 'ipucu', hidden: 'hidden' });
    tepe.appendChild(ipucuKutu);
    var ekran = $('#ekran section');
    ekran.insertBefore(tepe, ekran.firstChild);
    fabDurum(true);

    dizinGetir().then(function (ix) {
      var aralik = kapsamKelimeAralik(kapsam);
      var baslangic = Math.max(aralik[0], ix.ayahStart[ayetDizini(g.bas.s, g.bas.a)]);
      var izleyici = new T.Tracker(ix, { range: aralik, cursor: baslangic, now: Date.now() });

      var tanima = new Tanima();
      tanima.lang = D.ayar.tanimaDili;
      tanima.continuous = true;
      tanima.interimResults = true;
      tanima.maxAlternatives = 1;

      takip = {
        tanima: tanima, izleyici: izleyici, g: g, kapsam: kapsam, ix: ix,
        basladi: Date.now(), sayac: {}, saat: null, sonKaydirma: 0, aktif: true,
        ogeler: { nabiz: nabiz, durum: durumMetin, olcek: olcekIc, ipucu: ipucuKutu }
      };

      // Tanıyıcı ara sonuçları büyüterek yollar; yalnız yeni eklenen kelimeleri al.
      tanima.onresult = function (e) {
        var yeni = [];
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var jetonlar = T.tokens(e.results[i][0].transcript);
          var onceki = takip.sayac[i] || 0;
          if (jetonlar.length > onceki) {
            yeni = yeni.concat(jetonlar.slice(onceki));
            takip.sayac[i] = jetonlar.length;
          }
        }
        if (yeni.length) takipIsle(yeni);
      };
      tanima.onstart = function () { durumBildir('canli', 'Dinliyorum — oku'); };
      tanima.onerror = function (e) {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          durumBildir('hata', 'Mikrofon izni verilmedi'); takipBitir(true);
        } else if (e.error === 'network') {
          durumBildir('hata', 'Ses tanıma için internet gerekiyor');
        } else {
          durumBildir('uyari', 'Tanıma hatası: ' + e.error);
        }
      };
      tanima.onend = function () {
        // Tarayıcı sessizlikte kendiliğinden durur; oturum sürüyorsa yeniden başlat.
        if (takip && takip.aktif) { try { tanima.start(); } catch (e) {} }
      };

      takip.bitir = function () { takipBitir(false); };
      try { tanima.start(); } catch (e) { durumBildir('hata', 'Mikrofon başlatılamadı'); }

      takip.saat = setInterval(function () {
        if (!takip) return;
        var st = izleyici.checkStall(Date.now());
        if (st && D.ayar.sesliIpucu) {
          var yer = ix.locate(Math.min(izleyici.cursor, izleyici.range[1] - 1));
          var konum = yer && dizindenKonum(yer.ayah);
          var oge = konum && kelimeOgesi(konum.s, konum.a, yer.word);
          takip.ogeler.ipucu.textContent = oge ? oge.textContent : (st.ipucu[0] || '');
          takip.ogeler.ipucu.hidden = false;
          durumBildir('uyari', 'Takıldın mı? İpucu yukarıda');
          if (oge) oge.classList.remove('gizli');     // takılınca o tek kelimeyi aç
        }
      }, 1000);

      imleciGoster();
    }).catch(function (e) {
      durumMetin.textContent = 'Dizin yüklenemedi: ' + e.message;
      nabiz.className = 'nabiz hata';
    });

    function durumBildir(sinif, metin) {
      if (!takip) return;
      takip.ogeler.nabiz.className = 'nabiz ' + sinif;
      takip.ogeler.durum.textContent = metin;
    }

    function imleciGoster() {
      if (!takip) return;
      var yer = takip.ix.locate(Math.min(takip.izleyici.cursor, takip.izleyici.range[1] - 1));
      if (!yer) return;
      var konum = dizindenKonum(yer.ayah);
      var oge = kelimeOgesi(konum.s, konum.a, yer.word);
      hepsi('.k.simdi').forEach(function (x) { x.classList.remove('simdi'); });
      if (oge) {
        oge.classList.add('simdi');
        var simdi = Date.now();
        if (D.ayar.otoKaydir && simdi - takip.sonKaydirma > 700) {
          takip.sonKaydirma = simdi;
          oge.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }

    function takipIsle(kelimeler) {
      if (!takip) return;
      var olaylar = takip.izleyici.feed(kelimeler, Date.now());
      takip.ogeler.ipucu.hidden = true;
      var ilerledi = false;

      olaylar.forEach(function (o) {
        var konum = o.ayah !== undefined ? dizindenKonum(o.ayah) : null;
        var oge = konum ? kelimeOgesi(konum.s, konum.a, o.word) : null;
        if (o.tip === 'ilerle') {
          ilerledi = true;
          if (oge) {
            oge.classList.add('okundu');
            oge.classList.remove('hata', 'atlandi', 'gizli');   // ezberde okunan kelime açılır
          }
          if (o.span === 2 && konum) {
            var yan = kelimeOgesi(konum.s, konum.a, o.word + 1);
            if (yan) { yan.classList.add('okundu'); yan.classList.remove('gizli'); }
          }
        } else if (o.tip === 'atlama' && oge) {
          oge.classList.add('atlandi');
        } else if (o.tip === 'yanlis' && oge) {
          oge.classList.add('hata');
        } else if (o.tip === 'sicrama') {
          durumBildir('uyari', 'Başka bir yere geçtin — takip oraya taşındı');
        } else if (o.tip === 'kayip') {
          durumBildir('uyari', 'Neresini okuduğunu bulamıyorum');
        }
      });

      if (ilerledi) {
        durumBildir('canli', 'Dinliyorum — oku');
        imleciGoster();
        takip.ogeler.olcek.style.width = Math.round(takip.izleyici.progress() * 100) + '%';
      }
      if (takip.izleyici.cursor >= takip.izleyici.range[1]) takipBitir(false);
    }

    function takipBitir(sessiz) {
      if (!takip) return;
      var izleyici = takip.izleyici, g2 = takip.g, kapsam2 = takip.kapsam;
      var sure = (Date.now() - takip.basladi) / 60000;
      takip.aktif = false;
      var rapor = izleyici.report();
      takipDurdurSessiz();
      fabDurum(false);
      if (sessiz) return;
      oturumKaydet(g2, kapsam2, rapor, sure);
      // Rapordan geriye dönünce mikrofon yeniden açılmasın.
      gorunum = { ad: 'okuyucu', kapsam: kapsam2, bas: g2.bas, duzen: g2.duzen };
      git({ ad: 'rapor', rapor: rapor, g: g2, kapsam: kapsam2, dakika: sure });
    }
  }

  function oturumKaydet(g, kapsam, rapor, dakika) {
    var gun = gunKaydi();
    gun.dakika += dakika;
    gun.kelime += rapor.okunanKelime;
    gun.hata += rapor.sayim.atlama + rapor.sayim.yanlis;
    gun.ayet += Math.max(0, Math.round(rapor.okunanKelime / 12));
    D.oturumlar.unshift({
      t: Date.now(), kapsam: kapsamAnahtar(kapsam), s: g.bas.s, a: g.bas.a,
      dakika: Math.round(dakika * 10) / 10, kelime: rapor.okunanKelime,
      isabet: Math.round(rapor.isabet * 100), atlama: rapor.sayim.atlama, yanlis: rapor.sayim.yanlis
    });
    D.oturumlar = D.oturumlar.slice(0, 40);
    if (g.ezber && D.ezber[g.ezber]) {
      D.ezber[g.ezber] = Object.assign(D.ezber[g.ezber],
        T.srsIlerlet(D.ezber[g.ezber], T.isabetNotu(rapor.isabet), Date.now()));
    }
    kaydet();
  }

  /* ================= ekran: Rapor ================= */
  CIZERLER.rapor = function (g) {
    $('#baslik').textContent = 'Okuma raporu';
    var r = g.rapor, k = el('section');
    var yuzde = Math.round(r.isabet * 100);
    var renk = yuzde >= 95 ? 'var(--yesil)' : yuzde >= 80 ? 'var(--altin)' : 'var(--turuncu)';

    k.appendChild(el('div', { sinif: 'kart', style: 'text-align:center' },
      el('div', { style: 'font-size:2.8rem;font-weight:800;color:' + renk, metin: '%' + yuzde }),
      el('div', { sinif: 'kucuk silik', metin: kapsamAdi(g.kapsam) + ' · isabet' }),
      el('div', { sinif: 'izgara dort', style: 'margin-top:16px' },
        kutu(sayi(r.okunanKelime), 'kelime'),
        kutu(sureMetni(g.dakika), g.dakika < 1 ? 'saniye' : 'dakika'),
        kutu(String(r.sayim.atlama), 'atlanan'),
        kutu(String(r.sayim.yanlis), 'yanlış')
      )
    ));

    if (!r.hatalar.length) {
      k.appendChild(el('div', { sinif: 'kart', style: 'text-align:center' },
        el('div', { style: 'font-size:1.6rem', metin: '✓' }),
        el('div', { sinif: 'kucuk', style: 'margin-top:6px', metin: 'Hiç hata yakalanmadı. Eline sağlık.' })));
    } else {
      k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Takıldığın yerler' }));
      var liste = el('div', { sinif: 'liste' });
      r.hatalar.slice(0, 30).forEach(function (h) {
        var konum = dizindenKonum(h.ayah);
        liste.appendChild(el('button', {
          sinif: 'oge', onclick: function () { okuyucuAc({ tur: 'sure', s: konum.s }, konum.a); }
        },
          el('div', { sinif: 'gövde' },
            el('div', { sinif: 'ad', metin: sureBilgi(konum.s).ad + ' ' + konum.s + ':' + konum.a }),
            el('div', { sinif: 'alt', metin: h.tip === 'atlama' ? 'atlanan kelime' : 'beklenen: ' + (h.beklenen || '—') + (h.duyulan ? ' · duyulan: ' + h.duyulan : '') })),
          el('span', { sinif: 'rozet ' + (h.tip === 'atlama' ? 'kirmizi' : ''), metin: h.tip === 'atlama' ? 'atlama' : 'yanlış' })
        ));
      });
      k.appendChild(liste);
      k.appendChild(el('div', { sinif: 'minik silik', style: 'padding:10px 2px', metin: 'Not: ses tanıma kusursuz değildir; gürültülü ortamda doğru okunan kelimeler de hata görünebilir.' }));
    }

    k.appendChild(el('div', { sinif: 'alt-cubuk' },
      el('button', {
        sinif: 'dugme', metin: 'Metne dön',
        onclick: function () { git({ ad: 'okuyucu', kapsam: g.kapsam, bas: g.g.bas, duzen: g.g.duzen }); }
      }),
      el('button', {
        sinif: 'dugme ana', metin: 'Tekrar oku',
        onclick: function () {
          git({ ad: 'okuyucu', kapsam: g.kapsam, bas: kapsamIlkAyet(g.kapsam), duzen: g.g.duzen,
                takip: true, gizli: g.g.gizli, ezber: g.g.ezber });
        }
      })
    ));
    return k;
  };
  /** Bir dakikanın altındaki okumalar "0 dakika" görünmesin. */
  function sureMetni(dakika) {
    return dakika < 1 ? String(Math.round(dakika * 60)) : String(Math.round(dakika * 10) / 10);
  }
  function kutu(buyuk, etiket) {
    return el('div', { sinif: 'kutu' }, el('div', { sinif: 'buyuk', metin: buyuk }), el('div', { sinif: 'etiket', metin: etiket }));
  }

  /* ================= ezber ================= */
  function ezberAdi(anahtar) { return kapsamAdi(anahtardanKapsam(anahtar)); }

  function ezberEkle(kapsam) {
    var anahtar = kapsamAnahtar(kapsam);
    if (D.ezber[anahtar]) { bildir('Zaten ezber listende'); return; }
    D.ezber[anahtar] = T.srsIlerlet(null, 4, Date.now());
    D.ezber[anahtar].vade = Date.now();            // ilk tekrar hemen
    kaydet();
    bildir(ezberAdi(anahtar) + ' ezbere eklendi');
  }
  function ezberVadesiGelenler() {
    var simdi = Date.now(), out = [];
    for (var k in D.ezber) if (D.ezber[k].vade <= simdi) out.push(k);
    return out.sort(function (a, b) { return D.ezber[a].vade - D.ezber[b].vade; });
  }
  function ezberAc(anahtar) {
    var kapsam = anahtardanKapsam(anahtar);
    git({ ad: 'okuyucu', kapsam: kapsam, bas: kapsamIlkAyet(kapsam), takip: true, gizli: true, ezber: anahtar });
  }
  function ezberOgesi(anahtar) {
    var b = D.ezber[anahtar];
    var gec = Math.floor((Date.now() - b.vade) / 86400000);
    var etiket = b.vade > Date.now()
      ? Math.ceil((b.vade - Date.now()) / 86400000) + ' gün sonra'
      : (gec > 0 ? gec + ' gün gecikti' : 'bugün');
    var tur = anahtar.split(':')[0];
    var vadesiGeldi = b.vade <= Date.now();
    return el('div', { sinif: 'oge' },
      el('div', { sinif: 'no' }, el('span', { metin: tur === 'sayfa' ? '۩' : tur === 'aralik' ? '⟲' : '✦' })),
      el('button', { sinif: 'oge-ac', onclick: function () { ezberAc(anahtar); } },
        el('div', { sinif: 'ad', metin: ezberAdi(anahtar) }),
        el('div', { sinif: 'alt', metin: etiket + ' · ' + (b.tekrar || 0) + '. tekrar' })),
      el('span', { sinif: 'rozet ' + (vadesiGeldi ? 'altin' : ''), metin: vadesiGeldi ? 'Oku' : 'Bekliyor' }),
      el('button', {
        sinif: 'oge-kaldir', metin: '✕', 'aria-label': ezberAdi(anahtar) + ' bölümünü listeden çıkar',
        onclick: function () {
          if (!confirm(ezberAdi(anahtar) + ' ezber listesinden çıkarılsın mı?')) return;
          delete D.ezber[anahtar]; kaydet(); ciz();
        }
      })
    );
  }

  CIZERLER.ezber = function () {
    $('#baslik').textContent = 'Ezber';
    var k = el('section');
    var anahtarlar = Object.keys(D.ezber);
    if (!anahtarlar.length) {
      k.appendChild(el('div', { sinif: 'bos' },
        el('span', { sinif: 'im', metin: '✦' }),
        el('div', { metin: 'Ezber listen boş.' }),
        el('div', { sinif: 'minik', style: 'margin-top:8px;line-height:1.6', metin: 'Bir sûre, bir mushaf sayfası ya da seçtiğin bir ayet aralığını “Ezbere ekle” ile listeye al. Uygulama ne zaman tekrar etmen gerektiğini kendisi hesaplar; ezber testinde metin bulanık başlar, sen okudukça açılır.' })));
      k.appendChild(el('div', { sinif: 'satir', style: 'gap:8px' },
        el('button', { sinif: 'dugme ana buyu', metin: 'Kısa sûreler', onclick: function () { okuyucuAc({ tur: 'sure', s: 112 }, 1); } }),
        el('button', { sinif: 'dugme buyu', metin: 'Son sayfa', onclick: function () { okuyucuAc({ tur: 'sayfa', p: META.sayfa.length }); } })));
      return k;
    }
    var vadesi = ezberVadesiGelenler();
    var ortalama = Math.round(anahtarlar.reduce(function (t, a) { return t + (D.ezber[a].aralik || 0); }, 0) / anahtarlar.length);
    k.appendChild(el('div', { sinif: 'izgara' },
      kutu(String(anahtarlar.length), 'bölüm'),
      kutu(String(vadesi.length), 'bugün'),
      kutu(String(ortalama), 'ort. gün')
    ));
    if (vadesi.length) {
      k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Bugün tekrar edilecek' }));
      k.appendChild(el('div', { sinif: 'liste' }, vadesi.map(function (a) { return ezberOgesi(a); })));
    }
    var sonra = anahtarlar.filter(function (a) { return D.ezber[a].vade > Date.now(); })
      .sort(function (a, b) { return D.ezber[a].vade - D.ezber[b].vade; });
    if (sonra.length) {
      k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Sırada' }));
      k.appendChild(el('div', { sinif: 'liste' }, sonra.map(function (a) { return ezberOgesi(a); })));
    }
    return k;
  };

  /* ================= ekran: Durum ================= */
  CIZERLER.istatistik = function () {
    $('#baslik').textContent = 'Durum';
    var k = el('section');
    var gunler = Object.keys(D.gunluk);
    var toplamDk = 0, toplamKelime = 0, toplamHata = 0;
    gunler.forEach(function (g) {
      toplamDk += D.gunluk[g].dakika; toplamKelime += D.gunluk[g].kelime; toplamHata += D.gunluk[g].hata;
    });
    k.appendChild(el('div', { sinif: 'izgara dort' },
      kutu(String(seriHesapla()), 'gün seri'),
      kutu(String(Math.round(toplamDk)), 'dakika'),
      kutu(sayi(toplamKelime), 'kelime'),
      kutu(toplamKelime ? '%' + Math.round(100 * (1 - toplamHata / toplamKelime)) : '—', 'isabet')
    ));

    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Son 5 hafta' }));
    var takvim = el('div', { sinif: 'takvim' });
    var bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    var basla = new Date(bugun); basla.setDate(basla.getDate() - 34);
    for (var i = 0; i < 35; i++) {
      var g = new Date(basla); g.setDate(basla.getDate() + i);
      var kod = bugunKod(g.getTime());
      var v = D.gunluk[kod];
      var yogun = !v ? 0 : v.dakika >= 15 ? 3 : v.dakika >= 5 ? 2 : v.dakika > 0 ? 1 : 0;
      takvim.appendChild(el('i', {
        'data-yogun': yogun, 'data-bugun': kod === bugunKod() ? '1' : null,
        title: kod + (v ? ' · ' + Math.round(v.dakika) + ' dk' : '')
      }));
    }
    k.appendChild(el('div', { sinif: 'kart' }, takvim));

    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Son okumalar' }));
    if (!D.oturumlar.length) {
      k.appendChild(el('div', { sinif: 'kart kucuk silik', metin: 'Henüz mikrofonla okuma yapmadın.' }));
    } else {
      var liste = el('div', { sinif: 'liste' });
      D.oturumlar.slice(0, 12).forEach(function (o) {
        var t = new Date(o.t);
        var ad = o.kapsam ? ezberAdi(o.kapsam) : sureBilgi(o.s).ad;
        liste.appendChild(el('button', {
          sinif: 'oge',
          onclick: function () {
            var kapsam = o.kapsam ? anahtardanKapsam(o.kapsam) : { tur: 'sure', s: o.s };
            git({ ad: 'okuyucu', kapsam: kapsam, bas: { s: o.s, a: o.a } });
          }
        },
          el('div', { sinif: 'gövde' },
            el('div', { sinif: 'ad', metin: ad }),
            el('div', { sinif: 'alt', metin: t.toLocaleDateString('tr-TR') + ' · ' + o.dakika + ' dk · ' + sayi(o.kelime) + ' kelime' })),
          el('span', { sinif: 'rozet ' + (o.isabet >= 95 ? 'yesil' : o.isabet >= 80 ? 'altin' : 'kirmizi'), metin: '%' + o.isabet })
        ));
      });
      k.appendChild(liste);
    }
    return k;
  };

  /* ================= başlangıç ================= */
  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.dataset.tema = D.ayar.tema;
    document.documentElement.style.setProperty('--hat-boy', D.ayar.hatBoyu + 'rem');

    $('#geri').addEventListener('click', geriGit);
    $('#ayarlar-ac').addEventListener('click', function () { git({ ad: 'ayarlar' }); });
    $('#menu-ac').addEventListener('click', okuyucuMenusu);
    hepsi('#serit button').forEach(function (b) {
      b.addEventListener('click', function () { gecmis = []; git({ ad: b.dataset.sekme }, false); });
    });
    // Açık bir tabaka ya da işlem çubuğu varsa ekrana dokunulunca kapansın.
    document.addEventListener('click', function (e) {
      if (e.target.closest('.ayet-islem') || e.target.closest('.mushaf-ayet') ||
          e.target.closest('.ayet') || e.target.closest('.mik-fab')) return;
      ayetSecimiTemizle();
    });

    getJSON('data/meta.json').then(function (m) {
      META = m;
      ciz();
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
    }).catch(function (e) {
      $('#ekran').innerHTML = '';
      $('#ekran').appendChild(el('div', { sinif: 'bos' },
        el('span', { sinif: 'im', metin: '⚠' }),
        el('div', { metin: 'Kur\'an verisi yüklenemedi.' }),
        el('div', { sinif: 'minik', style: 'margin-top:8px', metin: e.message })));
    });
  });

  window.addEventListener('beforeunload', takipDurdurSessiz);
})();
