/*!
 * Tilavet — Kur'an okuma, dinleme ve ezber takibi
 *
 * Sunucu yok: metin ve meal statik JSON olarak gelir, ses tanıma tarayıcıda
 * çalışır, ilerleme localStorage'da durur. Eşleştirme mantığının tamamı
 * engine.js içindedir; bu dosya yalnız arayüz ve akıştır.
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
  function pad3(n) { return ('00' + n).slice(-3); }
  function bugunKod(t) { var d = t ? new Date(t) : new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function sayi(n) { return (n || 0).toLocaleString('tr-TR'); }

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
      kari: 'Alafasy_128kbps', hatBoyu: 1.75, meal: true, okunus: false,
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
  /** Eşleştirme metni ve dizin yalnız gerektiğinde (mikrofon/arama) yüklenir. */
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
  function sureAraligi(n) {
    var s = sureBilgi(n);
    return [IX.ayahStart[s.ofset], IX.ayahEnd(s.ofset + s.ayet - 1)];
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
    kap.innerHTML = '';
    var f = CIZERLER[gorunum.ad] || CIZERLER.bugun;
    kap.appendChild(f(gorunum));
    kap.scrollTop = gorunum.kaydir || 0;

    var kokEkran = ['bugun', 'kuran', 'ezber', 'istatistik'].indexOf(gorunum.ad) >= 0;
    $('#geri').hidden = kokEkran;
    $('#marka').hidden = !kokEkran;
    $('#serit').hidden = !kokEkran && ['ayarlar', 'rapor'].indexOf(gorunum.ad) < 0;
    Array.prototype.forEach.call(document.querySelectorAll('#serit button'), function (b) {
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

    // Kaldığın yer
    if (D.sonKonum) {
      var s = sureBilgi(D.sonKonum.s);
      k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Kaldığın yer' }));
      k.appendChild(el('button', {
        sinif: 'oge', onclick: function () { git({ ad: 'okuyucu', s: D.sonKonum.s, a: D.sonKonum.a }); }
      },
        el('div', { sinif: 'no' }, el('span', { metin: String(s.n) })),
        el('div', { sinif: 'gövde' },
          el('div', { sinif: 'ad', metin: s.ad + ' sûresi' }),
          el('div', { sinif: 'alt', metin: D.sonKonum.a + '. ayet · ' + ayetSayfasi(D.sonKonum.s, D.sonKonum.a) + '. sayfa' })),
        el('div', { sinif: 'sag', metin: 'Devam ›' })
      ));
    }

    // Bugünün tekrarları
    var vadesi = ezberVadesiGelenler();
    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Bugünün tekrarı' }));
    if (!vadesi.length) {
      k.appendChild(el('div', { sinif: 'kart kucuk silik' },
        Object.keys(D.ezber).length
          ? 'Bugün tekrarı gelen bir bölüm yok. Ne güzel.'
          : 'Henüz ezber bölümü eklemedin. Bir sûre açıp “Ezbere ekle” de.'));
    } else {
      k.appendChild(el('div', { sinif: 'liste' }, vadesi.slice(0, 4).map(ezberOgesi)));
    }

    // Günün ayeti
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
    var idx = (gun * 7919) % 6236;
    var yer = dizindenKonum(idx);
    sureGetir(yer.s).then(function (d) {
      var ayet = d.ayetler[yer.a - 1];
      kart.innerHTML = '';
      kart.appendChild(el('div', { sinif: 'ayet-vitrin', metin: ayet.u }));
      if (D.ayar.meal) kart.appendChild(el('div', { sinif: 'meal', metin: ayet.m }));
      kart.appendChild(el('div', { sinif: 'satir', style: 'margin-top:12px' },
        el('div', { sinif: 'minik silik buyu', metin: sureBilgi(yer.s).ad + ' ' + yer.s + ':' + yer.a }),
        el('button', { sinif: 'dugme ince', metin: 'Aç', onclick: function () { git({ ad: 'okuyucu', s: yer.s, a: yer.a }); } })
      ));
    }).catch(function (e) { kart.textContent = 'Ayet yüklenemedi.'; });
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
        liste.appendChild(el('button', { sinif: 'oge', onclick: function () { git({ ad: 'okuyucu', s: c.s, a: c.a }); } },
          el('div', { sinif: 'no' }, el('span', { metin: String(c.n) })),
          el('div', { sinif: 'gövde' },
            el('div', { sinif: 'ad', metin: c.n + '. Cüz' }),
            el('div', { sinif: 'alt', metin: s.ad + ' ' + c.a + '. ayetten başlar' }))
        ));
      });
    } else {
      var sayfaAra = el('input', { sinif: 'arama', type: 'number', min: 1, max: 604, placeholder: 'Sayfa numarası (1–604)' });
      sayfaAra.addEventListener('input', function () { sayfaListesi(liste, sayfaAra.value); });
      k.appendChild(sayfaAra);
      sayfaListesi(liste, '');
    }
    k.appendChild(liste);
    return k;
  };

  function sureListesi(kap, sorgu) {
    kap.innerHTML = '';
    var q = (sorgu || '').toLocaleLowerCase('tr').trim();
    var sade = q.replace(/[âàáä]/g, 'a').replace(/[îíì]/g, 'i').replace(/[ûüù]/g, 'u').replace(/[ôö]/g, 'o');
    META.sure.forEach(function (s) {
      if (q) {
        var ad = s.ad.toLocaleLowerCase('tr').replace(/[âàáä]/g, 'a').replace(/[îíì]/g, 'i').replace(/[ûüù]/g, 'u').replace(/[ôö]/g, 'o');
        if (ad.indexOf(sade) < 0 && String(s.n).indexOf(q) !== 0 &&
            s.anlam.toLocaleLowerCase('tr').indexOf(q) < 0) return;
      }
      kap.appendChild(el('button', { sinif: 'oge', onclick: function () { git({ ad: 'okuyucu', s: s.n, a: 1 }); } },
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
    if (n >= 1 && n <= 604) liste = liste.slice(Math.max(0, n - 1), Math.min(604, n + 9));
    liste.slice(0, 120).forEach(function (p) {
      var s = sureBilgi(p.s);
      kap.appendChild(el('button', { sinif: 'oge', onclick: function () { git({ ad: 'okuyucu', s: p.s, a: p.a, sayfa: p.n }); } },
        el('div', { sinif: 'no' }, el('span', { metin: String(p.n) })),
        el('div', { sinif: 'gövde' },
          el('div', { sinif: 'ad', metin: p.n + '. sayfa' }),
          el('div', { sinif: 'alt', metin: s.ad + ' ' + p.a + '. ayet · ' + ayetCuzu(p.s, p.a) + '. cüz' }))
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
      D.ayar.hatBoyu = parseFloat(boy.value); document.documentElement.style.setProperty('--hat-boy', D.ayar.hatBoyu + 'rem'); kaydet();
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

  /* ================= ses (kâri) ================= */
  var ses = { calgi: null, s: 0, a: 0, surekli: false, kalanTekrar: 0 };
  function calgi() {
    if (!ses.calgi) {
      ses.calgi = new Audio();
      ses.calgi.addEventListener('ended', function () {
        if (ses.kalanTekrar > 0) { ses.kalanTekrar--; ayetCal(ses.s, ses.a, ses.surekli); return; }
        if (!ses.surekli) { ayetVurgu(null); return; }
        var s = sureBilgi(ses.s);
        if (ses.a < s.ayet) ayetCal(ses.s, ses.a + 1, true);
        else ayetVurgu(null);
      });
      ses.calgi.addEventListener('error', function () {
        if (ses.s) bildir('Ses yüklenemedi — bağlantını kontrol et');
        ayetVurgu(null);
      });
    }
    return ses.calgi;
  }
  function ayetCal(s, a, surekli) {
    ses.s = s; ses.a = a; ses.surekli = !!surekli;
    var c = calgi();
    c.src = sesUrl(s, a);
    c.play().catch(function () { bildir('Sesi başlatmak için ekrana dokun'); });
    ayetVurgu(a);
    ilerlemeYaz({ s: s, a: a });
  }
  function sesDurdur() {
    if (ses.calgi) { ses.calgi.pause(); ses.calgi.removeAttribute('src'); }
    ses.s = 0; ses.surekli = false; ses.kalanTekrar = 0;
    ayetVurgu(null);
    var d = $('#cal-dugme'); if (d) d.textContent = '▶  Dinle';
  }
  function ayetVurgu(a) {
    Array.prototype.forEach.call(document.querySelectorAll('.ayet'), function (e) {
      e.classList.toggle('etkin', a !== null && +e.dataset.a === a);
    });
    if (a !== null) {
      var hedef = document.querySelector('.ayet[data-a="' + a + '"]');
      if (hedef && D.ayar.otoKaydir) hedef.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  /* ================= ekran: Okuyucu ================= */
  function ilerlemeYaz(k) { D.sonKonum = { s: k.s, a: k.a }; kaydet(); }

  CIZERLER.okuyucu = function (g) {
    var s = sureBilgi(g.s);
    $('#baslik').textContent = s.ad + (g.gizli ? ' · ezber' : '');
    var k = el('section');
    var govde = el('div', {}, el('div', { sinif: 'yukleniyor', metin: 'Sûre yükleniyor…' }));
    k.appendChild(govde);
    ilerlemeYaz({ s: g.s, a: g.a || 1 });

    sureGetir(g.s).then(function (d) {
      govde.innerHTML = '';
      govde.appendChild(el('div', { sinif: 'sure-basi' },
        el('div', { sinif: 'ad-ar', metin: s.ar }),
        el('div', { sinif: 'ad-tr', metin: s.ad + ' sûresi' }),
        el('div', { sinif: 'minik silik', metin: s.anlam + ' · ' + s.ayet + ' ayet · ' + s.inis + ' · ' + s.cuz + '. cüz' })
      ));
      if (g.s !== 1 && g.s !== 9) {
        govde.appendChild(el('div', { sinif: 'besmele', metin: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ' }));
      }
      d.ayetler.forEach(function (ayet) { govde.appendChild(ayetKutusu(g, ayet)); });
      govde.appendChild(altCubuk(g));

      var hedef = document.querySelector('.ayet[data-a="' + (g.a || 1) + '"]');
      if (hedef && (g.a || 1) > 1) setTimeout(function () { hedef.scrollIntoView({ block: 'start' }); }, 30);
      if (g.takip) setTimeout(function () { takipBaslat(g); }, 120);
    }).catch(function (e) {
      govde.innerHTML = '';
      govde.appendChild(el('div', { sinif: 'bos', metin: 'Sûre yüklenemedi: ' + e.message }));
    });
    return k;
  };

  function ayetKutusu(g, ayet) {
    var anahtar = g.s + ':' + ayet.v;
    var yerImi = D.yerImleri.indexOf(anahtar) >= 0;
    var kutu = el('div', { sinif: 'ayet', 'data-a': ayet.v });

    var araclar = el('div', { sinif: 'ayet-arac' },
      el('button', { 'aria-label': 'Bu ayeti dinle', metin: '▷', onclick: function () { ayetCal(g.s, ayet.v, false); } }),
      el('button', {
        'aria-label': 'Bu ayetten itibaren mikrofonla oku', metin: '🎙',
        onclick: function () { git({ ad: 'okuyucu', s: g.s, a: ayet.v, takip: true }); }
      }),
      el('button', {
        'aria-label': 'Yer imi', metin: yerImi ? '★' : '☆', sinif: yerImi ? 'acik' : '',
        onclick: function (e) {
          var i = D.yerImleri.indexOf(anahtar);
          if (i >= 0) { D.yerImleri.splice(i, 1); e.target.textContent = '☆'; e.target.classList.remove('acik'); }
          else { D.yerImleri.push(anahtar); e.target.textContent = '★'; e.target.classList.add('acik'); }
          kaydet();
        }
      })
    );
    kutu.appendChild(el('div', { sinif: 'ayet-ust' },
      el('span', { sinif: 'ayet-no', metin: g.s + ':' + ayet.v }), araclar));

    var hat = el('div', { sinif: 'hat' });
    if (g.gizli) hat.dataset.gizli = '1';
    ayet.u.split(' ').forEach(function (kelime, i) {
      hat.appendChild(el('span', {
        sinif: 'k' + (g.gizli ? ' gizli' : ''), 'data-a': ayet.v, 'data-w': i, metin: kelime
      }));
      hat.appendChild(document.createTextNode(' '));
    });
    kutu.appendChild(hat);

    if (D.ayar.okunus) kutu.appendChild(el('div', { sinif: 'okunus', metin: ayet.l }));
    if (D.ayar.meal && !g.gizli) kutu.appendChild(el('div', { sinif: 'meal', metin: ayet.m }));
    return kutu;
  }

  function altCubuk(g) {
    var mikrofonVar = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    var cubuk = el('div', { sinif: 'alt-cubuk' });
    cubuk.appendChild(el('button', {
      sinif: 'dugme', id: 'cal-dugme', metin: '▶  Dinle',
      onclick: function (e) {
        if (ses.s) { sesDurdur(); }
        else { ayetCal(g.s, g.a || 1, true); e.target.textContent = '■  Durdur'; }
      }
    }));
    cubuk.appendChild(el('button', {
      sinif: 'dugme ana', id: 'mik-dugme', metin: '🎙  Mikrofonla oku',
      disabled: mikrofonVar ? null : 'disabled',
      onclick: function () {
        if (!mikrofonVar) { bildir('Tarayıcın ses tanımayı desteklemiyor'); return; }
        sesDurdur();
        git({ ad: 'okuyucu', s: g.s, a: g.a || 1, takip: true, gizli: g.gizli, ezber: g.ezber });
      }
    }));
    var ek = el('div', { sinif: 'satir', style: 'gap:8px;margin-top:8px' },
      el('button', {
        sinif: 'dugme ince buyu', metin: '✦ Ezbere ekle',
        onclick: function () { ezberEkle('sure:' + g.s); }
      }),
      el('button', {
        sinif: 'dugme ince buyu', metin: '↕ Sonraki sûre',
        onclick: function () { if (g.s < 114) git({ ad: 'okuyucu', s: g.s + 1, a: 1 }); }
      })
    );
    var sar = el('div', {}, cubuk, ek);
    if (!mikrofonVar) {
      sar.appendChild(el('div', { sinif: 'uyari-kutu', style: 'margin-top:10px' },
        'Bu tarayıcı canlı ses tanımayı desteklemiyor. Mikrofonla takip için Android’de Chrome, masaüstünde Chrome veya Edge kullan.'));
    }
    return sar;
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

  function kelimeOgesi(a, w) {
    return document.querySelector('.hat .k[data-a="' + a + '"][data-w="' + w + '"]');
  }

  function takipBaslat(g) {
    var Tanima = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Tanima) { bildir('Ses tanıma desteklenmiyor'); return; }

    var tepe = el('div', { sinif: 'takip-tepe' });
    var nabiz = el('i', { sinif: 'nabiz' });
    var durumMetin = el('div', { sinif: 'kucuk buyu', metin: 'Dizin hazırlanıyor…' });
    var olcekIc = el('i', { style: 'width:0%' });
    var bitir = el('button', { sinif: 'dugme ince', metin: 'Bitir' });
    tepe.appendChild(el('div', { sinif: 'durum' }, nabiz, durumMetin, bitir));
    tepe.appendChild(el('div', { sinif: 'olcek' }, olcekIc));
    var ipucuKutu = el('div', { sinif: 'ipucu', hidden: 'hidden' });
    tepe.appendChild(ipucuKutu);
    var ekran = $('#ekran section');
    ekran.insertBefore(tepe, ekran.firstChild);

    var acCubuk = document.querySelector('.alt-cubuk');
    if (acCubuk) acCubuk.parentElement.hidden = true;

    dizinGetir().then(function (ix) {
      var aralik = sureAraligi(g.s);
      var baslangic = ix.ayahStart[ayetDizini(g.s, g.a || 1)];
      var izleyici = new T.Tracker(ix, { range: aralik, cursor: baslangic, now: Date.now() });

      var tanima = new Tanima();
      tanima.lang = D.ayar.tanimaDili;
      tanima.continuous = true;
      tanima.interimResults = true;
      tanima.maxAlternatives = 1;

      takip = {
        tanima: tanima, izleyici: izleyici, g: g, ix: ix, baslangic: baslangic,
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
          durumBildir('hata', 'Mikrofon izni verilmedi');
          takipBitir(true);
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

      bitir.addEventListener('click', function () { takipBitir(false); });
      try { tanima.start(); } catch (e) { durumBildir('hata', 'Mikrofon başlatılamadı'); }

      takip.saat = setInterval(function () {
        if (!takip) return;
        var st = izleyici.checkStall(Date.now());
        if (st && D.ayar.sesliIpucu) {
          var ip = st.ipucu.length ? st.ipucu.join('  ') : '';
          var yer = ix.locate(izleyici.cursor);
          var oge = yer && kelimeOgesi(dizindenKonum(yer.ayah).a, yer.word);
          takip.ogeler.ipucu.textContent = oge ? oge.textContent : ip;
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
      var oge = kelimeOgesi(konum.a, yer.word);
      Array.prototype.forEach.call(document.querySelectorAll('.hat .k.simdi'), function (x) { x.classList.remove('simdi'); });
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
        var oge = konum ? kelimeOgesi(konum.a, o.word) : null;
        if (o.tip === 'ilerle') {
          ilerledi = true;
          if (oge) {
            oge.classList.add('okundu');
            oge.classList.remove('hata', 'atlandi', 'gizli');   // ezberde okunan kelime açılır
          }
          if (o.span === 2) {
            var yan = kelimeOgesi(konum.a, o.word + 1);
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
      var izleyici = takip.izleyici, g2 = takip.g;
      var sure = (Date.now() - takip.basladi) / 60000;
      takip.aktif = false;
      var rapor = izleyici.report();
      takipDurdurSessiz();
      if (sessiz) return;
      oturumKaydet(g2, rapor, sure);
      // Rapordan geriye dönünce mikrofon yeniden açılmasın: geçmişe
      // sûrenin takipsiz hâli girsin.
      gorunum = { ad: 'okuyucu', s: g2.s, a: g2.a || 1 };
      git({ ad: 'rapor', rapor: rapor, g: g2, dakika: sure });
    }
  }

  function oturumKaydet(g, rapor, dakika) {
    var gun = gunKaydi();
    gun.dakika += dakika;
    gun.kelime += rapor.okunanKelime;
    gun.hata += rapor.sayim.atlama + rapor.sayim.yanlis;
    gun.ayet += Math.max(0, Math.round(rapor.okunanKelime / 12));
    D.oturumlar.unshift({
      t: Date.now(), s: g.s, a: g.a || 1, dakika: Math.round(dakika * 10) / 10,
      kelime: rapor.okunanKelime, isabet: Math.round(rapor.isabet * 100),
      atlama: rapor.sayim.atlama, yanlis: rapor.sayim.yanlis
    });
    D.oturumlar = D.oturumlar.slice(0, 40);
    if (g.ezber) {
      var b = D.ezber[g.ezber];
      if (b) {
        var yeni = T.srsIlerlet(b, T.isabetNotu(rapor.isabet), Date.now());
        D.ezber[g.ezber] = Object.assign(b, yeni);
      }
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
      el('div', { sinif: 'kucuk silik', metin: 'isabet' }),
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
          sinif: 'oge',
          onclick: function () { git({ ad: 'okuyucu', s: konum.s, a: konum.a }); }
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
      el('button', { sinif: 'dugme', metin: 'Sûreye dön', onclick: function () { git({ ad: 'okuyucu', s: g.g.s, a: g.g.a || 1 }); } }),
      el('button', { sinif: 'dugme ana', metin: 'Tekrar oku', onclick: function () { git({ ad: 'okuyucu', s: g.g.s, a: g.g.a || 1, takip: true, gizli: g.g.gizli, ezber: g.g.ezber }); } })
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
  function ezberAdi(anahtar) {
    var p = anahtar.split(':');
    if (p[0] === 'sure') return sureBilgi(+p[1]).ad + ' sûresi';
    if (p[0] === 'sayfa') return p[1] + '. sayfa';
    return anahtar;
  }
  function ezberKonum(anahtar) {
    var p = anahtar.split(':');
    if (p[0] === 'sure') return { s: +p[1], a: 1 };
    var sayfa = META.sayfa[+p[1] - 1];
    return { s: sayfa.s, a: sayfa.a };
  }
  function ezberEkle(anahtar) {
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
  function ezberOgesi(anahtar) {
    var b = D.ezber[anahtar];
    var gec = Math.floor((Date.now() - b.vade) / 86400000);
    var etiket = b.vade > Date.now()
      ? Math.ceil((b.vade - Date.now()) / 86400000) + ' gün sonra'
      : (gec > 0 ? gec + ' gün gecikti' : 'bugün');
    return el('button', {
      sinif: 'oge', onclick: function () {
        var y = ezberKonum(anahtar);
        git({ ad: 'okuyucu', s: y.s, a: y.a, takip: true, gizli: true, ezber: anahtar });
      }
    },
      el('div', { sinif: 'no' }, el('span', { metin: '✦' })),
      el('div', { sinif: 'gövde' },
        el('div', { sinif: 'ad', metin: ezberAdi(anahtar) }),
        el('div', { sinif: 'alt', metin: etiket + ' · ' + (b.tekrar || 0) + '. tekrar' })),
      el('span', { sinif: 'rozet ' + (b.vade <= Date.now() ? 'altin' : ''), metin: b.vade <= Date.now() ? 'Oku' : 'Bekliyor' })
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
        el('div', { sinif: 'minik', style: 'margin-top:8px;line-height:1.6', metin: 'Bir sûre aç, alttaki “Ezbere ekle”ye dokun. Uygulama ne zaman tekrar etmen gerektiğini kendisi hesaplar; ezber testinde metin bulanıklaşır, sen okudukça açılır.' })));
      k.appendChild(el('button', { sinif: 'dugme ana', metin: 'Kısa sûrelerden başla', onclick: function () { git({ ad: 'okuyucu', s: 112, a: 1 }); } }));
      return k;
    }
    var vadesi = ezberVadesiGelenler();
    k.appendChild(el('div', { sinif: 'izgara' },
      kutu(String(anahtarlar.length), 'bölüm'),
      kutu(String(vadesi.length), 'bugün'),
      kutu(String(Math.round(anahtarlar.reduce(function (t, a) { return t + (D.ezber[a].aralik || 0); }, 0) / anahtarlar.length)), 'ort. gün')
    ));
    if (vadesi.length) {
      k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Bugün tekrar edilecek' }));
      k.appendChild(el('div', { sinif: 'liste' }, vadesi.map(ezberOgesi)));
    }
    var sonra = anahtarlar.filter(function (a) { return D.ezber[a].vade > Date.now(); })
      .sort(function (a, b) { return D.ezber[a].vade - D.ezber[b].vade; });
    if (sonra.length) {
      k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Sırada' }));
      k.appendChild(el('div', { sinif: 'liste' }, sonra.map(ezberOgesi)));
    }
    k.appendChild(el('div', { sinif: 'kart-baslik', metin: 'Listeyi düzenle' }));
    var duzen = el('div', { sinif: 'liste' });
    anahtarlar.forEach(function (a) {
      duzen.appendChild(el('div', { sinif: 'oge' },
        el('div', { sinif: 'gövde' }, el('div', { sinif: 'ad', metin: ezberAdi(a) })),
        el('button', {
          sinif: 'dugme ince', metin: 'Çıkar',
          onclick: function () { delete D.ezber[a]; kaydet(); ciz(); }
        })));
    });
    k.appendChild(duzen);
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
    k.appendChild(el('div', { sinif: 'izgara' },
      kutu(String(seriHesapla()), 'gün seri'),
      kutu(String(Math.round(toplamDk)), 'dakika'),
      kutu(sayi(toplamKelime), 'kelime'),
      kutu(gunler.length ? '%' + Math.round(100 * (1 - toplamHata / Math.max(1, toplamKelime))) : '—', 'isabet')
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
        liste.appendChild(el('button', {
          sinif: 'oge', onclick: function () { git({ ad: 'okuyucu', s: o.s, a: o.a }); }
        },
          el('div', { sinif: 'gövde' },
            el('div', { sinif: 'ad', metin: sureBilgi(o.s).ad + ' ' + o.s + ':' + o.a }),
            el('div', { sinif: 'alt', metin: t.toLocaleDateString('tr-TR') + ' · ' + o.dakika + ' dk · ' + sayi(o.kelime) + ' kelime' })),
          el('span', { sinif: 'rozet ' + (o.isabet >= 95 ? 'yesil' : o.isabet >= 80 ? 'altin' : 'kirmizi'), metin: '%' + o.isabet })
        ));
      });
      k.appendChild(liste);
    }
    return k;
  };

  /* ================= başlangıç ================= */
  function temaUygula() {
    document.documentElement.dataset.tema = D.ayar.tema;
    document.documentElement.style.setProperty('--hat-boy', D.ayar.hatBoyu + 'rem');
  }

  document.addEventListener('DOMContentLoaded', function () {
    temaUygula();
    $('#geri').addEventListener('click', geriGit);
    $('#ayarlar-ac').addEventListener('click', function () { git({ ad: 'ayarlar' }); });
    Array.prototype.forEach.call(document.querySelectorAll('#serit button'), function (b) {
      b.addEventListener('click', function () {
        sesDurdur(); gecmis = []; git({ ad: b.dataset.sekme }, false);
      });
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
