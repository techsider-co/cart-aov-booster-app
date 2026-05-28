(function () {
  var root = document.getElementById('aov-sticky-cart');
  if (!root) return;

  var isPreview = root.dataset.preview === 'true';

  var config = {};
  try {
    config = JSON.parse(root.dataset.config || '{}');
  } catch (error) {
    return;
  }

  config.position = config.position || 'bottom';
  config.buttonColor = config.buttonColor || '#000000';
  config.buttonText = config.buttonText || 'Sepete Ekle';
  config.hideOnDesktop = config.hideOnDesktop === true;

  if (!config.isActive && !isPreview) return;

  var stickyButton = root.querySelector('.aov-sticky-cart__button');
  var originalForm = null;
  var originalButton = null;
  var intersectionObserver = null;
  var disabledObserver = null;

  function findAddToCartTargets() {
    var forms = document.querySelectorAll('form[action^="/cart/add"], form[action*="/cart/add"]');

    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      var button =
        form.querySelector('[name="add"]') ||
        form.querySelector('button[type="submit"]') ||
        form.querySelector('input[type="submit"]');

      if (button) {
        return { form: form, button: button };
      }
    }

    if (forms.length > 0) {
      return { form: forms[0], button: null };
    }

    return { form: null, button: null };
  }

  function setBarVisible(visible) {
    root.classList.toggle('is-visible', visible);
    root.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function showPreviewBar() {
    setBarVisible(true);
    root.style.transform = 'translate3d(0, 0, 0)';
    root.style.opacity = '1';
    root.style.pointerEvents = 'auto';
  }

  function syncDisabledState() {
    if (!stickyButton || !originalButton) return;
    stickyButton.disabled = originalButton.disabled;
  }

  function injectAovBoosterAttribute() {
    if (!originalForm) return;

    var existingInput = originalForm.querySelector('input[name="attributes[_aov_booster]"]');
    if (existingInput) return;

    var hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'attributes[_aov_booster]';
    hiddenInput.value = 'true';
    originalForm.appendChild(hiddenInput);
  }

  function triggerOriginalAddToCart(event) {
    if (event) {
      event.preventDefault();
    }

    if (isPreview) {
      return;
    }

    if (!originalButton || originalButton.disabled) {
      return;
    }

    injectAovBoosterAttribute();
    originalButton.click();
  }

  function observeAddToCartVisibility(target) {
    if (!target || !('IntersectionObserver' in window)) {
      return;
    }

    if (intersectionObserver) {
      intersectionObserver.disconnect();
    }

    intersectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          setBarVisible(!entry.isIntersecting);
          syncDisabledState();
        });
      },
      {
        root: null,
        threshold: 0,
      }
    );

    intersectionObserver.observe(target);
    syncDisabledState();
  }

  function observeOriginalButtonDisabled() {
    if (!originalButton || !('MutationObserver' in window)) {
      return;
    }

    if (disabledObserver) {
      disabledObserver.disconnect();
    }

    disabledObserver = new MutationObserver(syncDisabledState);
    disabledObserver.observe(originalButton, {
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'class'],
    });
  }

  function initPreviewMode() {
    showPreviewBar();

    if (!stickyButton) {
      return true;
    }

    stickyButton.addEventListener('click', triggerOriginalAddToCart);

    var targets = findAddToCartTargets();
    originalForm = targets.form;
    originalButton = targets.button;

    if (originalButton) {
      syncDisabledState();
      observeOriginalButtonDisabled();
    }

    return true;
  }

  function init() {
    if (isPreview) {
      return initPreviewMode();
    }

    var targets = findAddToCartTargets();
    originalForm = targets.form;
    originalButton = targets.button;

    if (!originalForm && !originalButton) {
      return false;
    }

    var observeTarget = originalButton || originalForm;

    if (stickyButton) {
      stickyButton.addEventListener('click', triggerOriginalAddToCart);
    }

    observeAddToCartVisibility(observeTarget);

    if (originalButton) {
      observeOriginalButtonDisabled();
    }

    return true;
  }

  if (!init()) {
    window.setTimeout(function () {
      init();
    }, 500);
  }
})();
