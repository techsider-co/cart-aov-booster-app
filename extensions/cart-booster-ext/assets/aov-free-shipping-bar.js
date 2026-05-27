(function () {
  var root = document.getElementById('aov-shipping-bar');
  if (!root) return;

  var config = {};
  try {
    config = JSON.parse(root.dataset.config || '{}');
  } catch (error) {
    return;
  }

  if (!config.isActive) return;

  var messageEl = root.querySelector('.aov-shipping-bar__message');
  var progressEl = root.querySelector('.aov-shipping-bar__progress');
  var goalCents = Number(config.goalAmount || 0) * 100;
  var pending = false;
  var cartEndpoints = ['/cart/add', '/cart/change', '/cart/update', '/cart/clear'];

  if (!goalCents || !messageEl || !progressEl) return;

  function formatMoney(cents) {
    var currency = String(config.currency || 'TRY').toUpperCase();
    var value = Math.max(0, cents) / 100;
    var formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (currency === 'TRY') {
      return formatted + ' TL';
    }

    if (currency === 'USD') {
      return '$' + formatted;
    }

    if (currency === 'EUR') {
      return formatted + ' €';
    }

    if (currency === 'GBP') {
      return '£' + formatted;
    }

    return formatted + ' ' + currency;
  }

  function replaceAmount(template, amount) {
    return String(template || '').replace(/\[amount\]/g, amount);
  }

  function renderBar(totalPrice) {
    var total = Number(totalPrice) || 0;
    var percent = Math.min(100, Math.round((total / goalCents) * 100));

    if (total >= goalCents) {
      messageEl.textContent = config.successMessage || 'Tebrikler, Kargo Bedava!';
      progressEl.style.width = '100%';
      return;
    }

    if (total <= 0) {
      messageEl.textContent = config.initialMessage || '';
      progressEl.style.width = '0%';
      return;
    }

    var remaining = goalCents - total;
    var amountLabel = formatMoney(remaining);
    messageEl.textContent = replaceAmount(
      config.progressMessage || 'Kargoya sadece [amount] kaldı!',
      amountLabel
    );
    progressEl.style.width = percent + '%';
  }

  function refreshCart() {
    if (pending) return;
    pending = true;

    fetch('/cart.js', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Cart fetch failed');
        return response.json();
      })
      .then(function (cart) {
        renderBar(cart.total_price);
      })
      .catch(function () {})
      .finally(function () {
        pending = false;
      });
  }

  function shouldWatchRequest(input) {
    var url = '';

    if (typeof input === 'string') {
      url = input;
    } else if (input && typeof input.url === 'string') {
      url = input.url;
    }

    if (!url) return false;

    return cartEndpoints.some(function (endpoint) {
      return url.indexOf(endpoint) !== -1;
    });
  }

  function patchFetch() {
    if (!window.fetch || window.fetch.__aovPatched) return;

    var nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      var watch = shouldWatchRequest(input);

      return nativeFetch(input, init).then(function (response) {
        if (watch) {
          window.setTimeout(refreshCart, 0);
        }
        return response;
      });
    };

    window.fetch.__aovPatched = true;
  }

  function patchXHR() {
    if (!window.XMLHttpRequest || window.XMLHttpRequest.__aovPatched) return;

    var nativeOpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__aovWatchCart = typeof url === 'string' && url.indexOf('/cart') !== -1;
      return nativeOpen.apply(this, arguments);
    };

    var nativeSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.send = function () {
      if (this.__aovWatchCart) {
        this.addEventListener('load', function () {
          window.setTimeout(refreshCart, 0);
        });
      }
      return nativeSend.apply(this, arguments);
    };

    XMLHttpRequest.__aovPatched = true;
  }

  document.addEventListener('aov:cart:changed', refreshCart);
  document.addEventListener('cart:updated', refreshCart);
  document.addEventListener('cart:refresh', refreshCart);

  document.addEventListener('submit', function (event) {
    var form = event.target;

    if (!(form instanceof HTMLFormElement)) return;
    if (!form.action || form.action.indexOf('/cart/add') === -1) return;

    window.setTimeout(refreshCart, 300);
  });

  patchFetch();
  patchXHR();
  refreshCart();
})();
