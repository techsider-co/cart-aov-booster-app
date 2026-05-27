(function () {
  var root = document.getElementById('aov-sticky-cart');
  if (!root) return;

  var config = {};
  try {
    config = JSON.parse(root.dataset.config || '{}');
  } catch (error) {
    return;
  }

  if (!config.isActive) return;

  var addButton = root.querySelector('.aov-sticky-cart__button');
  var scrollThreshold = 300;
  var ticking = false;
  var addToCartControl = null;

  function findAddToCartControl() {
    var productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return null;

    return (
      productForm.querySelector('[name="add"]') ||
      productForm.querySelector('button[type="submit"]') ||
      productForm.querySelector('[type="submit"]')
    );
  }

  function isInViewport(element) {
    var rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  function shouldShowBar() {
    var scrolledPastThreshold = window.scrollY > scrollThreshold;
    var originalHidden = addToCartControl ? !isInViewport(addToCartControl) : scrolledPastThreshold;
    return scrolledPastThreshold || originalHidden;
  }

  function updateVisibility() {
    root.classList.toggle('is-visible', shouldShowBar());
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(function () {
      updateVisibility();
      ticking = false;
    });
  }

  function submitProductForm() {
    var productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return;

    if (typeof productForm.requestSubmit === 'function') {
      productForm.requestSubmit();
      return;
    }

    productForm.submit();
  }

  addToCartControl = findAddToCartControl();

  if (addButton) {
    addButton.addEventListener('click', function (event) {
      event.preventDefault();
      submitProductForm();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if (addToCartControl && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function () {
        updateVisibility();
      },
      { root: null, threshold: 0 }
    );

    observer.observe(addToCartControl);
  }

  updateVisibility();
})();
