// aov-free-shipping-bar.js
// Shopify App Embed Block — Free Shipping Bar
//
// Yükleme notu: Shopify, app embed JS dosyalarını <script defer> ile yükler.
// Bu IIFE çalıştığında DOM hazırdır.
//
// Mimari:
//   1. Fetch + XHR yamaları — mümkün olan en erken anda kurulur (sepet
//      isteklerini sayfa yükü sırasında bile yakalar).
//   2. prepareShippingBarRoot() — DOM'dan .aov-shipping-bar'ı bulur/taşır.
//   3. initShippingBar()        — config okur, render eder, event'leri bağlar.
//
// Yama → init arası iletişim bir iç event kanalı (aov:cart-data) üzerinden
// yapılır; böylece closure sınırlarını aşmadan renderBar çağrılabilir.

(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════════════
  // İç event kanalı: yamalar → renderBar
  // ════════════════════════════════════════════════════════════════════════
  // Yama kodu bir cart nesnesi elde ettiğinde bu event'i fırlatır.
  // initShippingBar dinleyiciyi kaydeder ve renderBar'ı çağırır.
  var AOV_CART_EVENT = 'aov:cart-data';

  function dispatchCartData(cart) {
    var evt;
    try {
      evt = new CustomEvent(AOV_CART_EVENT, { detail: cart, bubbles: false });
    } catch (e) {
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(AOV_CART_EVENT, false, false, cart);
    }
    document.dispatchEvent(evt);
  }

  // ════════════════════════════════════════════════════════════════════════
  // URL yardımcıları
  // ════════════════════════════════════════════════════════════════════════

  function getPathname(url) {
    if (!url) return '';
    try { return new URL(url, window.location.origin).pathname; }
    catch (e) { return String(url).split('?')[0]; }
  }

  // /cart/(add|change|update|clear)[.js]
  var RE_CART_MUTATION = /\/cart\/(add|change|update|clear)(\.js)?$/i;
  // /cart/add[.js]  — tek ürün döner, tam sepet çekmek gerekir
  var RE_CART_ADD      = /\/cart\/add(\.js)?$/i;

  function isCartMutationUrl(url) { return RE_CART_MUTATION.test(getPathname(url)); }
  function isCartAddUrl(url)      { return RE_CART_ADD.test(getPathname(url)); }

  // ════════════════════════════════════════════════════════════════════════
  // Global sepet fetch (yamalar tarafından çağrılır)
  // ════════════════════════════════════════════════════════════════════════

  var _gInflight = false;
  var _gQueued   = false;

  function globalFetchCart() {
    if (_gInflight) { _gQueued = true; return; }
    _gInflight = true;

    // Yamanmış window.fetch yerine doğrudan orijinal XMLHttpRequest'i kullan;
    // bu sayede sonsuz döngüden kaçınılır.
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/cart.js', true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { dispatchCartData(JSON.parse(xhr.responseText)); }
        catch (e) {}
      }
      _done();
    };
    xhr.onerror = _done;
    xhr.send();

    function _done() {
      _gInflight = false;
      if (_gQueued) { _gQueued = false; globalFetchCart(); }
    }
  }

  // Hız sınırlı zamanlayıcı
  var _gTimer = null;
  function scheduleGlobalFetch(ms) {
    if (ms === undefined || ms === null) {
      if (_gTimer) window.clearTimeout(_gTimer);
      _gTimer = window.setTimeout(function () { _gTimer = null; globalFetchCart(); }, 300);
      return;
    }
    window.setTimeout(globalFetchCart, ms);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Fetch yaması (modern Shopify temaları)
  // ════════════════════════════════════════════════════════════════════════

  function patchFetch() {
    if (!window.fetch || window.fetch.__aovPatched) return;
    var _native = window.fetch.bind(window);

    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input
        : (input && input.url ? input.url : '');
      var isMutation = isCartMutationUrl(url);
      var isAdd      = isMutation && isCartAddUrl(url);

      var p = _native(input, init);

      if (isMutation) {
        p.then(function (res) {
          if (!res.ok) return;
          if (isAdd) {
            // /cart/add yalnızca eklenen ürünü döner; tam sepeti çek
            scheduleGlobalFetch(150);
          } else {
            // /cart/change veya /cart/update tam sepeti döner
            res.clone().json()
              .then(function (cart) { dispatchCartData(cart); })
              .catch(function () { scheduleGlobalFetch(150); });
          }
        }).catch(function () {});
      }

      return p;
    };

    window.fetch.__aovPatched = true;
  }

  // ════════════════════════════════════════════════════════════════════════
  // XHR yaması (Timber, Turbo ve benzeri eski temalar)
  // ════════════════════════════════════════════════════════════════════════

  function patchXHR() {
    if (XMLHttpRequest.__aovPatched) return;

    var _Native = XMLHttpRequest;

    function PatchedXHR() {
      var _xhr   = new _Native();
      var _url   = '';
      var _isMut = false;
      var _isAdd = false;

      // Proxy: tüm özellikleri ve metodları ilet
      var self = this;

      // open'ı yakala
      this.open = function (method, url, async, user, pass) {
        _url   = String(url || '');
        _isMut = isCartMutationUrl(_url);
        _isAdd = _isMut && isCartAddUrl(_url);
        return _xhr.open.apply(_xhr, arguments);
      };

      // load event'ini takip et
      _xhr.addEventListener('load', function () {
        if (!_isMut || _xhr.status < 200 || _xhr.status >= 300) return;
        if (_isAdd) {
          scheduleGlobalFetch(150);
        } else {
          try {
            dispatchCartData(JSON.parse(_xhr.responseText));
          } catch (e) {
            scheduleGlobalFetch(150);
          }
        }
      });

      // Geri kalan metod ve özellikleri proxy et
      var proxyMethods = [
        'send', 'abort', 'setRequestHeader',
        'getResponseHeader', 'getAllResponseHeaders', 'overrideMimeType',
      ];
      for (var m = 0; m < proxyMethods.length; m++) {
        (function (method) {
          self[method] = function () { return _xhr[method].apply(_xhr, arguments); };
        })(proxyMethods[m]);
      }

      var proxyEvents = [
        'onload', 'onerror', 'onprogress', 'onabort',
        'ontimeout', 'onreadystatechange', 'onloadstart', 'onloadend',
      ];
      for (var e = 0; e < proxyEvents.length; e++) {
        (function (evName) {
          Object.defineProperty(self, evName, {
            get: function () { return _xhr[evName]; },
            set: function (v) { _xhr[evName] = v; },
          });
        })(proxyEvents[e]);
      }

      var proxyProps = [
        'readyState', 'response', 'responseText', 'responseType',
        'responseURL', 'responseXML', 'status', 'statusText',
        'timeout', 'upload', 'withCredentials',
      ];
      for (var p = 0; p < proxyProps.length; p++) {
        (function (prop) {
          Object.defineProperty(self, prop, {
            get: function () { return _xhr[prop]; },
            set: function (v) { _xhr[prop] = v; },
          });
        })(proxyProps[p]);
      }

      this.addEventListener    = function () { return _xhr.addEventListener.apply(_xhr, arguments); };
      this.removeEventListener = function () { return _xhr.removeEventListener.apply(_xhr, arguments); };
      this.dispatchEvent       = function () { return _xhr.dispatchEvent.apply(_xhr, arguments); };
    }

    PatchedXHR.prototype            = _Native.prototype;
    PatchedXHR.__aovPatched         = true;
    PatchedXHR.UNSENT               = 0;
    PatchedXHR.OPENED               = 1;
    PatchedXHR.HEADERS_RECEIVED     = 2;
    PatchedXHR.LOADING              = 3;
    PatchedXHR.DONE                 = 4;

    window.XMLHttpRequest = PatchedXHR;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 0. Yamaları kur — init'ten ÖNCE
  // ════════════════════════════════════════════════════════════════════════
  patchFetch();
  patchXHR();

  // ════════════════════════════════════════════════════════════════════════
  // 1. Bar kök elementini hazırla
  // ════════════════════════════════════════════════════════════════════════

  var root = prepareShippingBarRoot();
  if (!root) return;

  initShippingBar(root);

  // ════════════════════════════════════════════════════════════════════════
  // DOM: kök elementi bul / oluştur
  // ════════════════════════════════════════════════════════════════════════

  function prepareShippingBarRoot() {
    var nodes = [].slice.call(document.querySelectorAll('.aov-shipping-bar'));
    if (!nodes.length) return null;

    var mount = document.getElementById('aov-shipping-bar-root');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'aov-shipping-bar-root';
      mount.className = 'aov-shipping-bar-root';
      document.body.insertBefore(mount, document.body.firstChild);
    }

    var primary = nodes[0];
    for (var i = 1; i < nodes.length; i++) nodes[i].remove();
    if (primary.parentElement !== mount) mount.appendChild(primary);
    return primary;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Config okuma
  // ════════════════════════════════════════════════════════════════════════

  function readConfig(el) {
    // Liquid | escape filtresi HTML entity'lerini encode eder (&quot; vb.).
    // getAttribute() bunları otomatik decode eder → JSON.parse doğru çalışır.
    var raw = el.getAttribute('data-config');
    if (!raw) return {};
    try {
      return JSON.parse(raw.trim());
    } catch (e) {
      if (typeof console !== 'undefined') {
        console.warn('[AOV ShippingBar] data-config parse hatası:', e);
      }
      return {};
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // CSS custom property uygulama
  // ════════════════════════════════════════════════════════════════════════

  function applyThemeStyles(r, c) {
    var vars = [
      ['--aov-bar-color',      c.barColor],
      ['--aov-progress-color', c.progressColor],
      ['--aov-text-color',     c.textColor],
      ['--aov-track-color',    c.trackColor],
      ['--aov-bar-min-height', c.barHeight + 'px'],
      ['--aov-font-size',      c.fontSize + 'px'],
      ['--aov-track-height',   c.trackHeight + 'px'],
      ['--aov-font-family',    c.fontFamily],
    ];
    for (var i = 0; i < vars.length; i++) {
      if (vars[i][1] != null) r.style.setProperty(vars[i][0], String(vars[i][1]));
    }

    var bgUrl = typeof c.backgroundImageUrl === 'string' ? c.backgroundImageUrl.trim() : '';
    if (bgUrl) {
      // Tek tırnak karakterlerini escape et (CSS url() içinde güvenli)
      r.style.setProperty('--aov-bg-image', "url('" + bgUrl.replace(/'/g, "\\'") + "')");
      r.classList.add('aov-shipping-bar--has-image');
    } else {
      r.style.setProperty('--aov-bg-image', 'none');
      r.classList.remove('aov-shipping-bar--has-image');
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. Ana init
  // ════════════════════════════════════════════════════════════════════════

  function initShippingBar(root) {
    var isPreview = root.dataset.preview === 'true';
    var isActive  = root.dataset.active  === 'true';
    var config    = readConfig(root);

    // ── Varsayılanları uygula ────────────────────────────────────────────
    config.goalAmount      = Math.max(1, Number(config.goalAmount)   || 500);
    config.currency        = config.currency        || 'TRY';
    config.initialMessage  = config.initialMessage  || 'Kargo bedava fırsatını yakala!';
    config.progressMessage = config.progressMessage || 'Kargoya sadece [amount] kaldı!';
    config.successMessage  = config.successMessage  || 'Tebrikler, Kargo Bedava!';
    config.barColor        = config.barColor        || '#000000';
    config.progressColor   = config.progressColor   || '#22c55e';
    config.textColor       = config.textColor       || '#ffffff';
    config.trackColor      = config.trackColor      || '#ffffff40';
    config.barHeight       = Math.max(1, Number(config.barHeight)    || 56);
    config.fontSize        = Math.max(1, Number(config.fontSize)     || 16);
    config.trackHeight     = Math.max(1, Number(config.trackHeight)  || 8);
    config.fontFamily      = config.fontFamily      || 'inherit';
    config.backgroundImageUrl = config.backgroundImageUrl || '';

    // ── goalCents hesabı ─────────────────────────────────────────────────
    // config.goalAmount → tam TL değeri (ör. 500)
    // Shopify cart API → kuruş (cent) cinsinden (ör. 50 000 = 500 TL)
    // goalCents = goalAmount × 100  →  birimler eşleşir
    var goalCents = Math.round(config.goalAmount * 100);

    applyThemeStyles(root, config);

    // ── Pasifse gizle ────────────────────────────────────────────────────
    if (!isActive && !isPreview) {
      root.style.display = 'none';
      clearPageOffset();
      return;
    }

    root.style.display = '';

    var mountEl = document.getElementById('aov-shipping-bar-root');
    if (!goalCents) return;

    // ── Debounce durumu ──────────────────────────────────────────────────
    var localTimer     = null;
    var localInflight  = false;
    var localQueued    = false;

    // ── DOM ──────────────────────────────────────────────────────────────

    function getElements() {
      return {
        messageEl:  root.querySelector('.aov-shipping-bar__message'),
        progressEl: root.querySelector('.aov-shipping-bar__progress'),
      };
    }

    // ── Sayfa kaydırma ofseti ────────────────────────────────────────────

    function clearPageOffset() {
      document.documentElement.classList.remove('aov-has-shipping-bar');
      document.documentElement.style.removeProperty('--aov-shipping-bar-offset');
    }

    function syncPageOffset() {
      if (!mountEl || root.style.display === 'none') { clearPageOffset(); return; }
      var height = mountEl.offsetHeight;
      if (!height) { clearPageOffset(); return; }
      document.documentElement.classList.add('aov-has-shipping-bar');
      document.documentElement.style.setProperty('--aov-shipping-bar-offset', height + 'px');
    }

    if (window.ResizeObserver && mountEl) {
      new ResizeObserver(syncPageOffset).observe(mountEl);
    }

    // ── Sepet toplamı ────────────────────────────────────────────────────

    /**
     * Shopify /cart.js yanıtından kuruş cinsinden sepet toplamı döner.
     *
     * Öncelik:
     *   1. items_subtotal_price  — sadece ürün toplamı; kargo/sipariş indirimi
     *      barı geri götürmez. Kargo bedava barı için en doğru değer.
     *   2. total_price           — sipariş indirimleri dahil genel toplam.
     *   3. items[] elle topla    — her ikisi de yoksa yedek.
     */
    function cartTotalCents(cart) {
      if (!cart) return 0;

      if (cart.items_subtotal_price != null) {
        return Math.max(0, Number(cart.items_subtotal_price) || 0);
      }
      if (cart.total_price != null) {
        return Math.max(0, Number(cart.total_price) || 0);
      }

      // Son çare: items dizisini topla
      var items = Array.isArray(cart.items) ? cart.items : [];
      var sum = 0;
      for (var i = 0; i < items.length; i++) {
        sum += Math.max(0, Number(items[i].line_price) || 0);
      }
      return sum;
    }

    // ── Para biçimlendirme ───────────────────────────────────────────────

    function formatMoney(cents) {
      var cur = String(config.currency || 'TRY').toUpperCase();
      var val = (Math.max(0, cents) / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (cur === 'TRY') return val + ' TL';
      if (cur === 'USD') return '$' + val;
      if (cur === 'EUR') return val + ' \u20ac';
      if (cur === 'GBP') return '\u00a3' + val;
      return val + ' ' + cur;
    }

    // ── İlerleme barı render ─────────────────────────────────────────────

    function setProgressScale(percent) {
      var els = getElements();
      if (!els.progressEl) return;
      var scale    = Math.min(1, Math.max(0, percent / 100));
      var scaleStr = scale.toFixed(6);
      els.progressEl.style.setProperty('--aov-progress-scale', scaleStr);
      els.progressEl.style.transform = 'scaleX(' + scaleStr + ')';
      root.style.setProperty('--aov-progress-scale', scaleStr);
    }

    /**
     * renderBar(totalCents)
     *
     * İlerleme formülü: percent = totalCents / goalCents × 100
     *
     * goalCents  = config.goalAmount × 100  (tüm değerler kuruş cinsinden)
     * totalCents = Shopify cart toplamı      (zaten kuruş cinsinden)
     *
     * Birim eşleşmesi: her ikisi de kuruş → formül doğru.
     */
    function renderBar(totalCents) {
      var total = Math.max(0, Number(totalCents) || 0);

      // Önizleme: boş sepette barı görünür kıl
      if (isPreview && total === 0) {
        total = Math.round(goalCents / 2);
      }

      var percent    = Math.min(100, (total / goalCents) * 100);
      var nextMessage;
      var els        = getElements();

      if (total >= goalCents) {
        nextMessage = config.successMessage;
        percent     = 100;
      } else if (total <= 0) {
        nextMessage = config.initialMessage;
        percent     = 0;
      } else {
        var remainingCents = goalCents - total;
        nextMessage = String(config.progressMessage).replace(
          /\[amount\]/g,
          formatMoney(remainingCents)
        );
      }

      setProgressScale(percent);
      if (els.messageEl) els.messageEl.textContent = nextMessage;
      syncPageOffset();
    }

    // ── Yerel sepet çekme ────────────────────────────────────────────────

    function refreshCart() {
      if (localInflight) { localQueued = true; return; }
      localInflight = true;

      fetch('/cart.js', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (cart) { renderBar(cartTotalCents(cart)); })
        .catch(function (err) {
          if (typeof console !== 'undefined') {
            console.warn('[AOV ShippingBar] Sepet çekme hatası:', err);
          }
        })
        .finally(function () {
          localInflight = false;
          if (localQueued) { localQueued = false; refreshCart(); }
        });
    }

    /**
     * Hız sınırlı refresh planlaması.
     *
     * scheduleRefresh()   → debounced 300 ms (art arda event'leri birleştirir)
     * scheduleRefresh(ms) → tek seferlik ms ms sonra tetiklenir
     *
     * DÜZELTME: Önceki sürümde typeof ms === 'number' her zaman true döndürüp
     * debounce'u devre dışı bırakıyordu.
     */
    function scheduleRefresh(ms) {
      if (ms === undefined || ms === null) {
        if (localTimer) window.clearTimeout(localTimer);
        localTimer = window.setTimeout(function () {
          localTimer = null;
          refreshCart();
        }, 300);
        return;
      }
      window.setTimeout(refreshCart, ms);
    }

    // ── Cart payload işleme ──────────────────────────────────────────────

    function onCartPayload(cart) {
      if (!cart) return false;
      if (
        cart.total_price != null ||
        cart.items_subtotal_price != null ||
        Array.isArray(cart.items)
      ) {
        renderBar(cartTotalCents(cart));
        return true;
      }
      return false;
    }

    // ── Tema cart event'leri ─────────────────────────────────────────────

    function onThemeCartEvent(event) {
      if (event && event.detail) {
        if (onCartPayload(event.detail.cart)) return;
        if (onCartPayload(event.detail))      return;
      }
      scheduleRefresh(); // payload yok → debounced full fetch
    }

    var themeCartEvents = [
      'cart:change',
      'cart:updated',
      'cart:refresh',
      'cart:item-added',
      'product:added-to-cart',
      'theme:cart:change',
      'ajaxcart:updated',    // SomeTheme
      'CartDrawer:open',     // Dawn & türevleri
      AOV_CART_EVENT,        // Fetch/XHR yamalarından gelen iç event
    ];
    for (var _ei = 0; _ei < themeCartEvents.length; _ei++) {
      document.addEventListener(themeCartEvents[_ei], onThemeCartEvent);
    }

    // Klasik form submit
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      var action = (form.getAttribute('action') || form.action || '').toLowerCase();
      if (action.indexOf('/cart/add') !== -1) {
        scheduleRefresh(350);
        scheduleRefresh(900);
      }
    }, true);

    // Buton tıklaması
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest(
        '[name="add"], [data-add-to-cart], .add-to-cart, ' +
        '.product-form__submit, [data-product-form] button[type="submit"]'
      )) {
        scheduleRefresh(400);
        scheduleRefresh(1100);
      }
    }, true);

    // Sekme yeniden görünür oldu
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshCart();
    });

    // 3 saniyelik polling yedek (özel sepet implementasyonları için)
    window.setInterval(function () {
      if (!document.hidden) refreshCart();
    }, 3000);

    // ── İlk render ────────────────────────────────────────────────────────
    refreshCart();
    syncPageOffset();
  }

})();