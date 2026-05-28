// aov-free-shipping-bar.js

(function () {
  var root = prepareShippingBarRoot();
  if (!root) return;
  initShippingBar(root);

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

  function readConfig(el) {
    var raw = el.getAttribute('data-config');
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function applyThemeStyles(r, c) {
    var vars = [
      ['--aov-bar-color', c.barColor],
      ['--aov-progress-color', c.progressColor],
      ['--aov-text-color', c.textColor],
      ['--aov-track-color', c.trackColor],
      ['--aov-bar-min-height', c.barHeight + 'px'],
      ['--aov-font-size', c.fontSize + 'px'],
      ['--aov-track-height', c.trackHeight + 'px'],
      ['--aov-font-family', c.fontFamily],
    ];
    for (var i = 0; i < vars.length; i++) {
      if (vars[i][1] != null) r.style.setProperty(vars[i][0], vars[i][1]);
    }

    // Apply background image if provided
    var bgUrl = c.backgroundImageUrl;
    if (bgUrl && typeof bgUrl === 'string' && bgUrl.trim() !== '') {
      r.style.setProperty('--aov-bg-image', "url('" + bgUrl.trim() + "')");
      r.classList.add('aov-shipping-bar--has-image');
    } else {
      r.style.setProperty('--aov-bg-image', 'none');
      r.classList.remove('aov-shipping-bar--has-image');
    }
  }

  function initShippingBar(root) {
    var isPreview = root.dataset.preview === 'true';
    var isActive = root.dataset.active === 'true';
    var config = readConfig(root);

    config.goalAmount = Number(config.goalAmount) || 500;
    config.currency = config.currency || 'TRY';
    config.initialMessage = config.initialMessage || 'Kargo bedava fırsatını yakala!';
    config.progressMessage = config.progressMessage || 'Kargoya sadece [amount] kaldı!';
    config.successMessage = config.successMessage || 'Tebrikler, Kargo Bedava!';
    config.barColor = config.barColor || '#000000';
    config.progressColor = config.progressColor || '#22c55e';
    config.textColor = config.textColor || '#ffffff';
    config.trackColor = config.trackColor || '#ffffff40';
    config.barHeight = Number(config.barHeight) || 56;
    config.fontSize = Number(config.fontSize) || 16;
    config.trackHeight = Number(config.trackHeight) || 8;
    config.fontFamily = config.fontFamily || 'inherit';
    config.backgroundImageUrl = config.backgroundImageUrl || '';

    // goalAmount is stored as a whole-unit value (e.g. 500 = 500 TL).
    // The Shopify cart API returns prices in cents (sub-units), so we convert.
    var goalCents = Math.round(config.goalAmount * 100);

    applyThemeStyles(root, config);

    if (!isActive && !isPreview) {
      root.style.display = 'none';
      clearPageOffset();
      return;
    }

    root.style.display = '';

    var mountEl = document.getElementById('aov-shipping-bar-root');

    // Guard: nothing to do if no goal is set
    if (!goalCents) return;

    // ── Debounce / inflight state ──────────────────────────────────────────
    var refreshTimer = null;
    var cartFetchInflight = false;
    var cartFetchQueued = false;

    // ── DOM helpers ────────────────────────────────────────────────────────

    function getElements() {
      return {
        messageEl: root.querySelector('.aov-shipping-bar__message'),
        progressEl: root.querySelector('.aov-shipping-bar__progress'),
      };
    }

    // ── Page-offset bookkeeping ────────────────────────────────────────────

    function clearPageOffset() {
      document.documentElement.classList.remove('aov-has-shipping-bar');
      document.documentElement.style.removeProperty('--aov-shipping-bar-offset');
    }

    function syncPageOffset() {
      if (!mountEl || root.style.display === 'none') {
        clearPageOffset();
        return;
      }
      var height = mountEl.offsetHeight;
      if (!height) {
        clearPageOffset();
        return;
      }
      document.documentElement.classList.add('aov-has-shipping-bar');
      document.documentElement.style.setProperty('--aov-shipping-bar-offset', height + 'px');
    }

    if (window.ResizeObserver && mountEl) {
      new ResizeObserver(syncPageOffset).observe(mountEl);
    }

    // ── Cart helpers ───────────────────────────────────────────────────────

    /**
     * Returns the cart total in cents.
     *
     * Shopify exposes two price fields on /cart.js:
     *   • items_subtotal_price  – subtotal before shipping/discounts on the order
     *   • total_price           – grand total
     *
     * For a "free shipping" progress bar we want the subtotal so that
     * order-level discounts don't falsely bring the bar back down.
     * Fall back to total_price when subtotal is unavailable.
     */
    function cartTotalCents(cart) {
      if (!cart) return 0;
      var raw =
        cart.items_subtotal_price != null
          ? cart.items_subtotal_price
          : cart.total_price;
      return Math.max(0, Number(raw) || 0);
    }

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

    // ── Render ─────────────────────────────────────────────────────────────

    function setProgressScale(percent) {
      var els = getElements();
      if (!els.progressEl) return;
      var scale = Math.min(1, Math.max(0, percent / 100));
      var scaleStr = String(scale);
      els.progressEl.style.setProperty('--aov-progress-scale', scaleStr);
      els.progressEl.style.transform = 'scaleX(' + scaleStr + ')';
      root.style.setProperty('--aov-progress-scale', scaleStr);
    }

    /**
     * Renders the bar for a given cart total (in cents).
     *
     * Progress formula: totalCents / goalCents × 100
     * This is the canonical, correct calculation. goalCents is derived from
     * config.goalAmount (whole units) × 100, matching Shopify's cent-based prices.
     */
    function renderBar(totalCents) {
      var total = Math.max(0, Number(totalCents) || 0);

      // In preview mode with an empty cart, show 50 % so the bar is visible
      if (isPreview && total === 0) {
        total = Math.round(goalCents / 2);
      }

      var percent = Math.min(100, (total / goalCents) * 100);
      var nextMessage;
      var els = getElements();

      if (total >= goalCents) {
        nextMessage = config.successMessage;
        percent = 100;
      } else if (total <= 0) {
        nextMessage = config.initialMessage;
        percent = 0;
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

    // ── Cart fetching ──────────────────────────────────────────────────────

    function refreshCart() {
      if (cartFetchInflight) {
        cartFetchQueued = true;
        return;
      }
      cartFetchInflight = true;
      fetch('/cart.js', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
        .then(function (res) {
          if (!res.ok) throw new Error('cart fetch failed: ' + res.status);
          return res.json();
        })
        .then(function (cart) {
          renderBar(cartTotalCents(cart));
        })
        .catch(function () {
          // Silently ignore network errors; next poll will retry
        })
        .finally(function () {
          cartFetchInflight = false;
          if (cartFetchQueued) {
            cartFetchQueued = false;
            refreshCart();
          }
        });
    }

    /**
     * Schedules a cart refresh.
     *
     * FIX: The original code always entered the `typeof ms === 'number'` branch
     * because a numeric argument was always passed, meaning the debounce timer
     * was never used — every call fired a fresh setTimeout immediately instead
     * of coalescing rapid calls.
     *
     * New behaviour:
     *   scheduleRefresh()        → debounced (300 ms), coalesces rapid calls
     *   scheduleRefresh(ms)      → one-shot delay of exactly `ms` ms
     */
    function scheduleRefresh(ms) {
      if (ms === undefined || ms === null) {
        // Debounced path — coalesce rapid calls into one
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(function () {
          refreshTimer = null;
          refreshCart();
        }, 300);
        return;
      }
      // One-shot path — fire after the specified delay
      window.setTimeout(refreshCart, ms);
    }

    // ── Event helpers ──────────────────────────────────────────────────────

    function onCartPayload(cart) {
      if (
        cart &&
        (cart.total_price != null || cart.items_subtotal_price != null)
      ) {
        renderBar(cartTotalCents(cart));
        return true;
      }
      return false;
    }

    function onCartEvent(event) {
      if (event && event.detail) {
        if (onCartPayload(event.detail.cart)) return;
        if (onCartPayload(event.detail)) return;
      }
      // No usable payload — debounce a full cart refresh
      scheduleRefresh();
    }

    function isCartActionUrl(url) {
      if (!url) return false;
      var path = '';
      try {
        path = new URL(url, window.location.origin).pathname;
      } catch (e) {
        path = String(url).split('?')[0];
      }
      return /\/cart\/(add|change|update|clear)(\.js)?$/i.test(path);
    }

    // ── Fetch monkey-patch ─────────────────────────────────────────────────

    function patchFetch() {
      if (!window.fetch || window.fetch.__aovCartPatched) return;
      var nativeFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url =
          typeof input === 'string'
            ? input
            : input && input.url
              ? input.url
              : '';
        var watch = isCartActionUrl(url);
        return nativeFetch(input, init).then(function (res) {
          if (watch && res.ok) {
            res
              .clone()
              .json()
              .then(function (data) {
                if (!onCartPayload(data)) scheduleRefresh(200);
              })
              .catch(function () {
                scheduleRefresh(200);
              });
          }
          return res;
        });
      };
      window.fetch.__aovCartPatched = true;
    }

    patchFetch();

    // ── DOM event listeners ────────────────────────────────────────────────

    var cartEvents = [
      'cart:change',
      'cart:updated',
      'cart:refresh',
      'product:added-to-cart',
      'theme:cart:change',
    ];
    for (var i = 0; i < cartEvents.length; i++) {
      document.addEventListener(cartEvents[i], onCartEvent);
    }

    // Form submit (add-to-cart forms)
    document.addEventListener(
      'submit',
      function (e) {
        var form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        var action = (
          form.getAttribute('action') ||
          form.action ||
          ''
        ).toLowerCase();
        if (action.indexOf('/cart/add') !== -1) {
          // Two checks: one shortly after and one for slower themes
          scheduleRefresh(350);
          scheduleRefresh(800);
        }
      },
      true
    );

    // Click on add-to-cart buttons
    document.addEventListener(
      'click',
      function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (
          t.closest(
            '[name="add"], [data-add-to-cart], .add-to-cart, .product-form__submit',
          )
        ) {
          scheduleRefresh(400);
          scheduleRefresh(1000);
        }
      },
      true
    );

    // ── Polling fallback (3 s) ─────────────────────────────────────────────
    // Catches themes that use custom cart implementations not covered above.
    window.setInterval(function () {
      if (!document.hidden) refreshCart();
    }, 3000);

    // ── Initial render ─────────────────────────────────────────────────────
    refreshCart();
    syncPageOffset();
  }
})();