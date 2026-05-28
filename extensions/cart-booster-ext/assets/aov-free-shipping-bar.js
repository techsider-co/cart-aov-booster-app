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
    for (var i = 0; i < vars.length; i++) r.style.setProperty(vars[i][0], vars[i][1]);
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

    applyThemeStyles(root, config);

    if (!isActive && !isPreview) {
      root.style.display = 'none';
      clearPageOffset();
      return;
    }

    root.style.display = '';

    var messageEl = root.querySelector('.aov-shipping-bar__message');
    var progressEl = root.querySelector('.aov-shipping-bar__progress');
    var goalCents = Math.round(config.goalAmount * 100);
    var mountEl = document.getElementById('aov-shipping-bar-root');
    var refreshTimer = null;
    var cartFetchInflight = false;
    var cartFetchQueued = false;

    if (!goalCents || !messageEl || !progressEl) return;

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

    function cartTotalCents(cart) {
      if (!cart) return 0;
      return Number(cart.items_subtotal_price != null ? cart.items_subtotal_price : cart.total_price) || 0;
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

    function replaceAmount(template, amount) {
      return String(template || '').replace(/\[amount\]/g, amount);
    }

    function renderBar(totalPrice) {
      var total = Number(totalPrice) || 0;
      var progressTotal = total;
      if (isPreview && total === 0) progressTotal = Math.round(goalCents / 2);

      var percent = Math.min(100, Math.round((progressTotal / goalCents) * 100));
      var nextMessage = '';
      var nextWidth = '0%';

      if (total >= goalCents) {
        nextMessage = config.successMessage;
        nextWidth = '100%';
      } else if (total <= 0) {
        if (isPreview) {
          nextMessage = replaceAmount(config.progressMessage, formatMoney(goalCents));
          nextWidth = percent + '%';
        } else {
          nextMessage = config.initialMessage;
          nextWidth = '0%';
        }
      } else {
        nextMessage = replaceAmount(config.progressMessage, formatMoney(goalCents - total));
        nextWidth = percent + '%';
      }

      messageEl.textContent = nextMessage;
      progressEl.style.width = nextWidth;
      syncPageOffset();
    }

    function refreshCart() {
      if (isPreview) {
        renderBar(0);
        return;
      }
      if (cartFetchInflight) {
        cartFetchQueued = true;
        return;
      }
      cartFetchInflight = true;
      fetch('/cart.js', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('cart');
          return res.json();
        })
        .then(function (cart) {
          renderBar(cartTotalCents(cart));
        })
        .catch(function () {})
        .finally(function () {
          cartFetchInflight = false;
          if (cartFetchQueued) {
            cartFetchQueued = false;
            refreshCart();
          }
        });
    }

    function scheduleRefresh(ms) {
      if (isPreview) {
        renderBar(0);
        return;
      }
      if (typeof ms === 'number') {
        window.setTimeout(refreshCart, ms);
        return;
      }
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(function () {
        refreshTimer = null;
        refreshCart();
      }, 350);
    }

    function onCartEvent(event) {
      if (event && event.detail && event.detail.cart) {
        renderBar(cartTotalCents(event.detail.cart));
        return;
      }
      scheduleRefresh(200);
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

    function patchFetch() {
      if (!window.fetch || window.fetch.__aovCartPatched) return;
      var nativeFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : input && input.url ? input.url : '';
        var watch = isCartActionUrl(url);
        return nativeFetch(input, init).then(function (res) {
          if (watch && res.ok) scheduleRefresh(250);
          return res;
        });
      };
      window.fetch.__aovCartPatched = true;
    }

    if (!isPreview) {
      patchFetch();
      var events = ['cart:change', 'cart:updated', 'cart:refresh', 'product:added-to-cart'];
      for (var i = 0; i < events.length; i++) document.addEventListener(events[i], onCartEvent);

      document.addEventListener(
        'submit',
        function (e) {
          var form = e.target;
          if (!(form instanceof HTMLFormElement)) return;
          var action = (form.getAttribute('action') || form.action || '').toLowerCase();
          if (action.indexOf('/cart/add') !== -1) {
            scheduleRefresh(400);
            scheduleRefresh(900);
          }
        },
        true
      );

      document.addEventListener(
        'click',
        function (e) {
          var t = e.target;
          if (!t || !t.closest) return;
          if (t.closest('[name="add"], [data-add-to-cart], .add-to-cart, .product-form__submit')) {
            scheduleRefresh(500);
            scheduleRefresh(1200);
          }
        },
        true
      );

      window.setInterval(function () {
        if (!document.hidden) refreshCart();
      }, 5000);
    }

    refreshCart();
    syncPageOffset();
  }
})();
