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
  var cartEndpoints = ['/cart/add', '/cart/change', '/cart/update', '/cart/clear'];
  var refreshDelayMs = 500;
  var refreshTimer = null;
  var cartFetchInflight = false;
  var cartFetchQueued = false;

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
    var nextMessage = '';
    var nextWidth = '0%';

    if (total >= goalCents) {
      nextMessage = config.successMessage || 'Tebrikler, Kargo Bedava!';
      nextWidth = '100%';
    } else if (total <= 0) {
      nextMessage = config.initialMessage || '';
      nextWidth = '0%';
    } else {
      var remaining = goalCents - total;
      nextMessage = replaceAmount(
        config.progressMessage || 'Kargoya sadece [amount] kaldı!',
        formatMoney(remaining)
      );
      nextWidth = percent + '%';
    }

    window.requestAnimationFrame(function () {
      messageEl.textContent = nextMessage;
      progressEl.style.width = nextWidth;
    });
  }

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
      .then(function (response) {
        if (!response.ok) throw new Error('Cart fetch failed');
        return response.json();
      })
      .then(function (cart) {
        renderBar(cart.total_price);
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

  function scheduleRefresh() {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
    }

    refreshTimer = window.setTimeout(function () {
      refreshTimer = null;
      refreshCart();
    }, refreshDelayMs);
  }

  function resolveRequestUrl(input) {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof Request) {
      return input.url;
    }

    if (input && typeof input.url === 'string') {
      return input.url;
    }

    return '';
  }

  function normalizePathname(url) {
    if (!url) return '';

    try {
      return new URL(url, window.location.origin).pathname;
    } catch (error) {
      return url.split('?')[0];
    }
  }

  function isCartMutationRequest(url) {
    var pathname = normalizePathname(url);

    if (!pathname || pathname.indexOf('/cart.js') !== -1) {
      return false;
    }

    return cartEndpoints.some(function (endpoint) {
      return pathname.indexOf(endpoint) !== -1;
    });
  }

  function isSuccessfulStatus(status) {
    return status >= 200 && status < 300;
  }

  function onCartMutationSuccess() {
    scheduleRefresh();
  }

  function patchFetch() {
    if (!window.fetch || window.fetch.__aovCartObserverPatched) return;

    var nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      var requestUrl = resolveRequestUrl(input);
      var watch = isCartMutationRequest(requestUrl);

      return nativeFetch(input, init).then(function (response) {
        if (watch && response.ok) {
          onCartMutationSuccess();
        }

        return response;
      });
    };

    window.fetch.__aovCartObserverPatched = true;
  }

  function patchXHR() {
    if (!window.XMLHttpRequest || window.XMLHttpRequest.__aovCartObserverPatched) {
      return;
    }

    var nativeOpen = XMLHttpRequest.prototype.open;
    var nativeSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__aovCartMutationUrl =
        typeof url === 'string' ? url : url ? String(url) : '';
      return nativeOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      var watch = isCartMutationRequest(xhr.__aovCartMutationUrl);

      if (watch) {
        xhr.addEventListener('load', function () {
          if (isSuccessfulStatus(xhr.status)) {
            onCartMutationSuccess();
          }
        });
      }

      return nativeSend.apply(this, arguments);
    };

    window.XMLHttpRequest.__aovCartObserverPatched = true;
  }

  document.addEventListener('aov:cart:changed', scheduleRefresh);
  document.addEventListener('cart:updated', scheduleRefresh);
  document.addEventListener('cart:refresh', scheduleRefresh);

  document.addEventListener('submit', function (event) {
    var form = event.target;

    if (!(form instanceof HTMLFormElement)) return;

    var action = form.getAttribute('action') || form.action || '';
    if (action.indexOf('/cart/add') === -1) return;

    window.setTimeout(scheduleRefresh, refreshDelayMs);
  });

  patchFetch();
  patchXHR();
  refreshCart();
})();
