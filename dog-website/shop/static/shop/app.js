(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const catalog = JSON.parse($('#catalog-data').textContent);
  const products = catalog.products || [];
  const dogs = catalog.dogs || [];
  const productById = new Map(products.map(product => [product.id, product]));
  const categoryNames = {food: 'Food & treats', toys: 'Toys & play', accessories: 'Walk & wear', care: 'Beds & care'};
  const currency = new Intl.NumberFormat('en-KE', {maximumFractionDigits: 2});
  const money = amount => 'KSh ' + currency.format(Number(amount));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
  const staticRoot = document.body.dataset.staticRoot || '/static/';
  const whatsappNumber = (document.body.dataset.whatsappNumber || '').replace(/\D/g, '');
  const mpesaEnabled = document.body.dataset.mpesaEnabled === 'true';
  // Resolve the original demo illustrations for existing catalogues as well.
  // Custom image paths are preserved and no reseeding is required.
  const legacyProductPhotos = new Map([
    ['shop/images/food.svg', 'shop/images/products/food.jpg'],
    ['shop/images/toy.svg', 'shop/images/products/chew.jpg'],
    ['shop/images/ball.svg', 'shop/images/products/ball.jpg'],
    ['shop/images/leash.svg', 'shop/images/products/leash.jpg'],
    ['shop/images/bed.svg', 'shop/images/products/bed.jpg'],
    ['shop/images/bowl.svg', 'shop/images/products/bowl.jpg']
  ]);
  const resolvedImage = path => legacyProductPhotos.get(path) || path;
  const img = path => staticRoot + String(resolvedImage(path) || '').split('/').map(encodeURIComponent).join('/');
  const productPhotoDescriptions = new Map([
    ['shop/images/products/food.jpg', 'Close-up photograph of dry dog food kibble'],
    ['shop/images/products/chew.jpg', 'Dog playing with a pink rubber chew toy'],
    ['shop/images/products/ball.jpg', 'Photograph of a yellow tennis ball'],
    ['shop/images/products/leash.jpg', 'Brown leather dog lead with a metal clip on a red background'],
    ['shop/images/products/bed.jpg', 'Pomeranian resting in a grey cushioned dog bed'],
    ['shop/images/products/bowl.jpg', 'Blue ceramic dog bowl filled with kibble on a tiled floor']
  ]);
  const productAlt = product => productPhotoDescriptions.get(resolvedImage(product.image)) || 'Product image: ' + product.name;
  const icon = name => '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';
  const stockLimit = product => Math.min(99, Math.max(0, Number(product.stock) || 0));
  const whatsappUrl = message => whatsappNumber ? 'https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(message) : '';
  const freeDeliveryGoal = 5000;
  const productProfiles = {
    food: {sizes:['small','medium','large'], stages:['puppy','adult','senior'], detail:'A balanced everyday option for routine feeding. Check the final pack label for ingredients, feeding guidance and any dietary restrictions.'},
    toys: {sizes:['small','medium','large'], stages:['puppy','adult'], detail:'Built for supervised play. Choose a toy that matches your dog’s size, chewing style and play habits.'},
    accessories: {sizes:['small','medium','large'], stages:['puppy','adult','senior'], detail:'Designed for everyday outings with comfort and practical handling in mind.'},
    care: {sizes:['small','medium','large'], stages:['puppy','adult','senior'], detail:'Comfort-first essentials for rest, feeding and everyday care.'}
  };
  const productSizeTags = product => productProfiles[product.category]?.sizes || ['small','medium','large'];
  const productStageTags = product => productProfiles[product.category]?.stages || ['adult'];
  const matchesPrice = (product, value) => value === 'all' || (value === 'under1000' && Number(product.price) < 1000) || (value === '1000to2500' && Number(product.price) >= 1000 && Number(product.price) <= 2500) || (value === 'over2500' && Number(product.price) > 2500);

  function readStored(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function writeStored(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Shopping still works when browser storage is unavailable. */ }
  }

  let filter = 'all';
  const cart = Object.create(null);
  const storedCart = readStored('good-dog-bag', {});
  if (storedCart && typeof storedCart === 'object' && !Array.isArray(storedCart)) {
    for (const [id, quantity] of Object.entries(storedCart)) {
      const product = productById.get(Number(id));
      if (product && String(product.id) === id && Number.isInteger(quantity) && quantity > 0 && stockLimit(product)) {
        cart[id] = Math.min(quantity, stockLimit(product));
      }
    }
  }
  const storedFavorites = readStored('good-dog-favorites', []);
  const favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites.filter(id => Number.isInteger(id) && productById.has(id)) : []);
  let orderPending = false;
  let enquirySession = 0;
  let toastTimer;
  let boopCount = 0;
  let mpesaPollTimer;

  /* Respect both the operating system and the page's pause control. */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionPaused = readStored('good-dog-motion-paused', false) === true;
  const motionOff = () => reducedMotion.matches || motionPaused;
  function syncMotion() {
    document.documentElement.dataset.motion = motionOff() ? 'off' : 'on';
    const control = $('#toggle-motion');
    control.setAttribute('aria-pressed', String(motionOff()));
    control.disabled = reducedMotion.matches;
    control.textContent = reducedMotion.matches ? 'Reduced motion is on' : motionPaused ? 'Resume motion ▷' : 'Pause motion Ⅱ';
    control.title = reducedMotion.matches ? 'Following your device’s reduced-motion preference.' : 'Pause or resume decorative movement.';
  }
  $('#toggle-motion').addEventListener('click', () => {
    motionPaused = !motionPaused;
    writeStored('good-dog-motion-paused', motionPaused);
    syncMotion();
  });
  reducedMotion.addEventListener('change', syncMotion);
  syncMotion();

  function toast(message) {
    clearTimeout(toastTimer);
    const dialog = $('dialog[open]');
    const target = dialog ? dialog.querySelector('.dialog-toast') : $('#toast');
    $$('.dialog-toast').forEach(node => { node.textContent = ''; });
    $('#toast').classList.remove('show');
    $('#toast').textContent = '';
    target.textContent = message;
    if (!dialog) target.classList.add('show');
    toastTimer = setTimeout(() => {
      target.classList.remove('show');
      target.textContent = '';
    }, 3200);
  }

  function saveCart() {
    writeStored('good-dog-bag', cart);
    const count = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
    $('#cart-count').textContent = count;
    $('#open-cart').setAttribute('aria-label', 'Open shopping bag, ' + count + (count === 1 ? ' item' : ' items'));
  }

  function syncSavedButtons() {
    writeStored('good-dog-favorites', [...favorites]);
    $('#saved-count').textContent = favorites.size;
    $('#open-saved').setAttribute('aria-label', 'View ' + favorites.size + ' saved products');
    $$('[data-save]').forEach(button => {
      const product = productById.get(Number(button.dataset.save));
      if (!product) return;
      const saved = favorites.has(product.id);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', (saved ? 'Unsave ' : 'Save ') + product.name);
    });
  }

  function saveButton(product, extraClass = '') {
    return '<button class="icon-button save-product ' + extraClass + '" data-save="' + product.id + '" aria-pressed="' + favorites.has(product.id) + '" aria-label="' + esc((favorites.has(product.id) ? 'Unsave ' : 'Save ') + product.name) + '">' + icon('heart') + '</button>';
  }

  function renderProducts() {
    const query = $('#search').value.toLowerCase().trim();
    const size = $('#size-filter').value;
    const stage = $('#stage-filter').value;
    const price = $('#price-filter').value;
    let list = products.filter(product =>
      (filter === 'all' || (filter === 'saved' ? favorites.has(product.id) : product.category === filter)) &&
      (product.name + ' ' + product.description + ' ' + (categoryNames[product.category] || '')).toLowerCase().includes(query) &&
      (size === 'all' || productSizeTags(product).includes(size)) &&
      (stage === 'all' || productStageTags(product).includes(stage)) &&
      matchesPrice(product, price)
    );
    const sort = $('#sort').value;
    if (sort !== 'featured') list.sort((a, b) => (sort === 'low' ? 1 : -1) * (Number(a.price) - Number(b.price)));

    $('#products').innerHTML = list.map(product => {
      const available = stockLimit(product) > 0;
      return '<article class="product-card" data-product-category="' + esc(product.category) + '">' +
        '<div class="product-image">' +
          (product.badge ? '<span class="badge">' + esc(product.badge) + '</span>' : '') +
          '<button class="product-photo-button" data-product="' + product.id + '" aria-label="' + esc('View ' + product.name) + '"><img src="' + esc(img(product.image)) + '" alt="' + esc(productAlt(product)) + '" loading="lazy" width="1200" height="800"></button>' +
          saveButton(product) +
        '</div>' +
        '<div class="product-body"><span class="product-category">' + esc(categoryNames[product.category] || product.category) + '</span>' +
          '<div class="product-meta"><h3><button class="product-title-button" data-product="' + product.id + '">' + esc(product.name) + '</button></h3><span class="price">' + money(product.price) + '</span></div>' +
          '<p class="product-description">' + esc(product.description) + '</p>' +
          '<div class="product-actions"><button class="quick-view" data-product="' + product.id + '" aria-label="' + esc('Take a closer look at ' + product.name) + '">Take a peek ↗</button>' +
          '<button class="add-button" data-add="' + product.id + '" aria-label="' + esc(available ? 'Add ' + product.name + ' to bag' : product.name + ' is sold out') + '"' + (available ? '' : ' disabled') + '>' + (available ? icon('plus') + 'Add to bag' : 'Sold out') + '</button></div>' +
        '</div></article>';
    }).join('');

    $('#empty-products').hidden = list.length > 0;
    $('#empty-message').textContent = filter === 'saved' && favorites.size === 0
      ? 'Tap a heart on a product to keep all your favourites together.'
      : 'Try another search, or explore the whole collection.';
    $('#shop-status').textContent = list.length
      ? list.length + (list.length === 1 ? ' good thing' : ' good things') + (filter === 'saved' ? ' saved for later.' : ' to make their day.')
      : filter === 'saved' && favorites.size === 0 ? 'No saved products yet.' : 'No products match this search.';
  }

  function setFilter(value) {
    filter = ['all', 'saved', ...Object.keys(categoryNames)].includes(value) ? value : 'all';
    $$('[data-filter]').forEach(button => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderProducts();
  }

  function goToShop(category = 'all') {
    closeMenu();
    $('#search').value = '';
    setFilter(category);
    location.hash = 'shop';
    $('#shop-title').focus({preventScroll: true});
    $('#shop').scrollIntoView({behavior: motionOff() ? 'auto' : 'smooth', block: 'start'});
  }

  function resetShop() {
    $('#search').value = '';
    $('#sort').value = 'featured';
    $('#size-filter').value = 'all';
    $('#stage-filter').value = 'all';
    $('#price-filter').value = 'all';
    setFilter('all');
    $('#search').focus({preventScroll: true});
  }

  function addToCart(id, amount = 1) {
    const product = productById.get(id);
    if (!product) return;
    const next = (cart[id] || 0) + amount;
    if (next > stockLimit(product)) {
      toast('That’s all the listed stock for this item.');
      return;
    }
    cart[id] = next;
    saveCart();
    const bag = $('#open-cart');
    bag.classList.remove('cart-pop');
    requestAnimationFrame(() => bag.classList.add('cart-pop'));
    setTimeout(() => bag.classList.remove('cart-pop'), 500);
    toast(amount > 1 ? amount + ' × ' + product.name + ' are in the bag.' : product.name + ' is in the bag. Excellent choice!');
  }


  const boxSteps = [
    {key:'food', label:'Pick their food', kicker:'01 / SOMETHING TASTY', note:'Start with a bowl-worthy favourite.'},
    {key:'toys', label:'Pick something fun', kicker:'02 / PLAY MODE', note:'For fetch, chewing and glorious chaos.'},
    {key:'care', label:'Pick something cosy', kicker:'03 / COSY CORNER', note:'A little comfort goes a long way.'},
    {key:'accessories', label:'Pick a walk essential', kicker:'04 / OUT & ABOUT', note:'Ready for the next pavement adventure.'}
  ];
  const storedBox = readStored('good-dog-box', {});
  const dogBox = Object.create(null);
  if (storedBox && typeof storedBox === 'object' && !Array.isArray(storedBox)) {
    for (const step of boxSteps) {
      const id = Number(storedBox[step.key]);
      const product = productById.get(id);
      if (product && product.category === step.key && stockLimit(product) > 0) dogBox[step.key] = id;
    }
  }

  function boxProducts(category) {
    return products.filter(product => product.category === category && stockLimit(product) > 0);
  }

  function renderDogBox() {
    writeStored('good-dog-box', dogBox);
    $('#box-steps').innerHTML = boxSteps.map((step, stepIndex) => {
      const options = boxProducts(step.key);
      const selectedId = dogBox[step.key];
      return '<article class="box-step' + (selectedId ? ' complete' : '') + '">' +
        '<div class="box-step-copy"><span class="eyebrow">' + esc(step.kicker) + '</span><div><span class="box-step-number">' + String(stepIndex + 1).padStart(2, '0') + '</span><h3>' + esc(step.label) + '</h3></div><p>' + esc(step.note) + '</p></div>' +
        '<div class="box-option-row">' + (options.length ? options.map(product =>
          '<button class="box-option' + (selectedId === product.id ? ' selected' : '') + '" data-box-category="' + esc(step.key) + '" data-box-product="' + product.id + '" aria-pressed="' + (selectedId === product.id) + '">' +
            '<span class="box-option-image"><img src="' + esc(img(product.image)) + '" alt="' + esc(productAlt(product)) + '"><span class="box-check">' + icon('paw') + '</span></span>' +
            '<span class="box-option-copy"><strong>' + esc(product.name) + '</strong><small>' + money(product.price) + '</small></span>' +
          '</button>'
        ).join('') : '<p class="box-unavailable">No in-stock option is available for this step yet.</p>') + '</div>' +
      '</article>';
    }).join('');

    const chosen = boxSteps.map(step => productById.get(dogBox[step.key])).filter(Boolean);
    const total = chosen.reduce((sum, product) => sum + Number(product.price), 0);
    $('#box-progress-label').textContent = chosen.length + ' / ' + boxSteps.length;
    $('#box-total').textContent = money(total);
    $('#box-progress-paws').innerHTML = boxSteps.map((step, index) =>
      '<span class="' + (dogBox[step.key] ? 'filled' : '') + '" aria-label="Step ' + (index + 1) + (dogBox[step.key] ? ' complete' : ' incomplete') + '">' + icon('paw') + '</span>'
    ).join('');
    $('#box-summary').innerHTML = chosen.length ? boxSteps.map(step => {
      const product = productById.get(dogBox[step.key]);
      return product ? '<div class="box-summary-row"><img src="' + esc(img(product.image)) + '" alt=""><span><small>' + esc(categoryNames[step.key] || step.key) + '</small><strong>' + esc(product.name) + '</strong></span><b>' + money(product.price) + '</b></div>' : '';
    }).join('') : '<div class="box-empty-summary">' + icon('paw') + '<p>Your box is waiting for its first good thing.</p></div>';
    $('#box-add-all').disabled = chosen.length !== boxSteps.length;
  }

  function chooseBoxProduct(category, id) {
    const product = productById.get(id);
    if (!product || product.category !== category || stockLimit(product) < 1) return;
    dogBox[category] = id;
    renderDogBox();
    toast(product.name + ' added to your dog box.');
  }

  function surpriseDogBox() {
    for (const step of boxSteps) {
      const options = boxProducts(step.key);
      if (options.length) dogBox[step.key] = options[Math.floor(Math.random() * options.length)].id;
      else delete dogBox[step.key];
    }
    renderDogBox();
    toast('Surprise box built. Very good choices, obviously.');
  }

  function resetDogBox() {
    for (const step of boxSteps) delete dogBox[step.key];
    renderDogBox();
    toast('Dog box cleared. Fresh paws, fresh start.');
  }

  function addDogBoxToCart() {
    const chosen = boxSteps.map(step => productById.get(dogBox[step.key]));
    if (chosen.some(product => !product)) {
      toast('Complete all four picks before adding the box.');
      return;
    }
    const unavailable = chosen.find(product => (cart[product.id] || 0) + 1 > stockLimit(product));
    if (unavailable) {
      toast(unavailable.name + ' does not have enough listed stock for this box.');
      return;
    }
    chosen.forEach(product => { cart[product.id] = (cart[product.id] || 0) + 1; });
    saveCart();
    const bag = $('#open-cart');
    bag.classList.remove('cart-pop');
    requestAnimationFrame(() => bag.classList.add('cart-pop'));
    setTimeout(() => bag.classList.remove('cart-pop'), 500);
    toast('The whole Good Dog Box is in your bag. Tail wags incoming.');
  }

  function toggleFavorite(id) {
    const product = productById.get(id);
    if (!product) return;
    const focusedInGrid = $('#products').contains(document.activeElement);
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    syncSavedButtons();
    if (filter === 'saved') {
      renderProducts();
      if (focusedInGrid) {
        const next = $('#products [data-save]') || $('[data-filter="saved"]');
        next.focus({preventScroll: true});
      }
    }
    toast(product.name + (favorites.has(id) ? ' saved for later.' : ' removed from your saved favourites.'));
  }

  /* Keep focus usable across a cart rerender, including removal of the last item. */
  function renderCart(focusRequest) {
    let total = 0;
    const entries = Object.entries(cart);
    $('#cart-items').innerHTML = entries.length ? entries.map(([id, quantity]) => {
      const product = productById.get(Number(id));
      total += Number(product.price) * quantity;
      const disabled = orderPending ? ' disabled' : '';
      return '<div class="cart-row"><img src="' + esc(img(product.image)) + '" alt="" width="74" height="90"><div>' +
        '<div class="cart-item-top"><div><h3>' + esc(product.name) + '</h3><span class="unit-price">' + money(product.price) + ' each</span></div><strong>' + money(Number(product.price) * quantity) + '</strong></div>' +
        '<div class="quantity"><button data-qty="' + id + '" data-delta="-1" aria-label="' + esc('Decrease ' + product.name + ' quantity') + '"' + disabled + '>' + icon('minus') + '</button><span aria-label="' + quantity + ' in bag">' + quantity + '</span>' +
        '<button data-qty="' + id + '" data-delta="1" aria-label="' + esc('Increase ' + product.name + ' quantity') + '"' + disabled + '>' + icon('plus') + '</button><button class="remove" data-remove="' + id + '" aria-label="' + esc('Remove ' + product.name + ' from bag') + '"' + disabled + '>Remove</button></div></div></div>';
    }).join('') :
      '<div class="cart-empty">' + icon('bag') + '<h3>A little room for happy.</h3><p>Your bag is empty. Let’s find something that makes their tail wag.</p><button class="button dark" data-continue-shopping>Explore the good stuff ' + icon('arrow') + '</button></div>';

    $('#cart-total').textContent = money(total);
    $('#checkout-total').textContent = money(total);
    const remaining = Math.max(0, freeDeliveryGoal - total);
    $('#shipping-progress-copy').textContent = total >= freeDeliveryGoal ? 'Unlocked 🎉' : money(remaining) + ' to go';
    $('#shipping-progress-bar').style.width = Math.min(100, (total / freeDeliveryGoal) * 100) + '%';
    const cartIds = new Set(entries.map(([id]) => Number(id)));
    const recs = products.filter(product => !cartIds.has(product.id) && stockLimit(product) > 0).slice(0, 2);
    $('#cart-recommendations').innerHTML = entries.length && recs.length ? '<span class="eyebrow">YOU MAY ALSO LIKE</span><div class="recommendation-row">' + recs.map(product => '<button class="recommendation-card" data-add="' + product.id + '"><img src="' + esc(img(product.image)) + '" alt=""><span><strong>' + esc(product.name) + '</strong><small>' + money(product.price) + '</small></span>' + icon('plus') + '</button>').join('') + '</div>' : '';
    $('#checkout').hidden = entries.length === 0;
    $('#checkout').disabled = orderPending;
    if (!entries.length) $('#order-form').hidden = true;
    saveCart();

    if (focusRequest) {
      const selector = focusRequest.remove
        ? '[data-remove="' + focusRequest.id + '"]'
        : '[data-qty="' + focusRequest.id + '"][data-delta="' + focusRequest.delta + '"]';
      const target = $('#cart-items').querySelector(selector) ||
        $('#cart-items [data-qty]') || $('[data-continue-shopping]') || $('#cart-title');
      target.focus({preventScroll: true});
    }
  }

  /* Native dialogs retain Escape, focus trapping and accessible names. */
  const returnFocus = new WeakMap();
  const suppressReturn = new WeakSet();
  function openDialog(dialog, focusSelector) {
    closeMenu();
    returnFocus.set(dialog, document.activeElement);
    dialog.showModal();
    document.body.classList.add('dialog-open');
    if (focusSelector) dialog.querySelector(focusSelector)?.focus({preventScroll: true});
  }
  function closeDialog(dialog, restore = true) {
    if (!restore) suppressReturn.add(dialog);
    dialog.close();
  }
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      document.body.classList.toggle('dialog-open', Boolean($('dialog[open]')));
      dialog.querySelector('.dialog-toast').textContent = '';
      if (suppressReturn.has(dialog)) {
        suppressReturn.delete(dialog);
        return;
      }
      const target = returnFocus.get(dialog);
      if (target?.isConnected) target.focus({preventScroll: true});
      else $('#shop-title').focus({preventScroll: true});
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(dialog);
    });
  });

  function openProduct(id) {
    const product = productById.get(id);
    if (!product) return;
    const available = stockLimit(product) > 0;
    const profile = productProfiles[product.category] || productProfiles.care;
    const related = products.filter(entry => entry.id !== product.id && entry.category === product.category).slice(0, 2);
    $('#product-detail').innerHTML =
      '<div class="product-detail-layout"><div><div class="product-detail-image"><img src="' + esc(img(product.image)) + '" alt="' + esc(productAlt(product)) + '" width="1200" height="800"></div><p class="gallery-note">1 verified product photo in this demo · gallery is ready for additional real angles.</p></div><div>' +
      '<div class="product-detail-meta"><div><span class="product-category">' + esc(categoryNames[product.category] || product.category) + '</span><h2 id="product-title" tabindex="-1">' + esc(product.name) + '</h2><div class="mini-rating">★★★★★ <span>Demo rating · 4.8</span></div></div><span class="price">' + money(product.price) + '</span></div>' +
      '<p class="product-detail-copy">' + esc(product.description) + '</p><p class="product-detail-copy">' + esc(profile.detail) + '</p>' +
      '<div class="product-specs"><span><b>Dog size</b>' + profile.sizes.map(x => esc(x)).join(', ') + '</span><span><b>Life stage</b>' + profile.stages.map(x => esc(x)).join(', ') + '</span><span><b>Stock</b>' + stockLimit(product) + ' listed</span><span><b>Delivery</b>Confirmed after request</span></div>' +
      '<p class="stock-note' + (available ? '' : ' sold-out') + '">' + (available ? 'In stock · final availability confirmed by the shop' : 'Currently sold out') + '</p>' +
      '<div class="detail-buy-row"><div class="detail-quantity" aria-label="Choose quantity"><button data-detail-delta="-1" aria-label="Decrease quantity">' + icon('minus') + '</button><span id="detail-qty">1</span><button data-detail-delta="1" aria-label="Increase quantity">' + icon('plus') + '</button></div><div class="product-detail-actions"><button class="button dark" data-detail-add="' + product.id + '"' + (available ? '' : ' disabled') + '>' + icon('plus') + (available ? 'Add to happy bag' : 'Sold out') + '</button>' + saveButton(product) + '</div></div></div></div>' +
      (related.length ? '<div class="related-products"><span class="eyebrow">PAIRS WELL WITH</span><div>' + related.map(entry => '<button data-product="' + entry.id + '"><img src="' + esc(img(entry.image)) + '" alt=""><span><strong>' + esc(entry.name) + '</strong><small>' + money(entry.price) + '</small></span></button>').join('') + '</div></div>' : '') +
      '<p class="sample-note">Sample listing with representative photography and demo ratings. Replace with verified product specifications, images and reviews before launch.</p>';
    if ($('#product-dialog').open) $('#product-title').focus({preventScroll: true});
    else openDialog($('#product-dialog'), '#product-title');
  }

  function renderDogs() {
    $('#dogs-grid').innerHTML = dogs.map(dog =>
      '<article class="dog-card"><div class="dog-image"><span class="badge">' + esc(dog.personality) + '</span>' +
      '<button class="dog-photo-button" data-dog="' + dog.id + '" aria-label="' + esc('Meet ' + dog.name) + '"><img src="' + esc(img(dog.image)) + '" alt="' + esc('Illustrative photo for ' + dog.name + '’s sample profile') + '" loading="lazy" width="800" height="1000"></button><span class="profile-label">Sample profile</span></div>' +
      '<div class="dog-info"><div class="dog-name"><h3>' + esc(dog.name) + '</h3>' + icon('heart') + '</div><p>' + esc(dog.breed) + ' · ' + esc(dog.age) + '</p>' +
      '<div class="dog-card-bottom"><span class="price">' + money(dog.price) + '</span><button class="dog-meet" data-dog="' + dog.id + '">Meet ' + esc(dog.name) + icon('arrow') + '</button></div></div></article>'
    ).join('') || '<p class="dogs-empty">Our dog profiles are being updated. Come back soon to meet the personalities behind the paws.</p>';
  }

  function openDog(id) {
    const dog = dogs.find(entry => entry.id === id);
    if (!dog) return;
    enquirySession++;
    const puppy = /month/i.test(dog.age);
    $('#dog-detail').innerHTML =
      '<div class="dog-detail-hero"><img class="detail-photo" src="' + esc(img(dog.image)) + '" alt="' + esc('Illustrative photo for ' + dog.name + '’s sample profile') + '"><div><span class="eyebrow">MEET YOUR MAYBE-BEST-FRIEND</span><h2 class="detail-title" id="dog-title" tabindex="-1">Hello, I’m ' + esc(dog.name) + '.</h2><div class="detail-meta"><span>' + esc(dog.breed) + '</span><span>' + esc(dog.age) + '</span><span>' + money(dog.price) + '</span></div><p>' + esc(dog.description) + '</p></div></div>' +
      '<div class="dog-facts"><span><b>Energy</b>' + (puppy ? 'Playful / high' : 'Moderate') + '</span><span><b>Home fit</b>Discuss at meet-and-greet</span><span><b>With children</b>Verify individually</span><span><b>With dogs</b>Verify individually</span><span><b>Vaccinations</b>Request records</span><span><b>Location</b>Confirm with seller</span></div>' +
      '<div class="meeting-note">' + icon('heart') + '<span><strong>Meet first. Decide second.</strong> Ask for vaccination/deworming records, health history, temperament information and the dog’s living conditions.</span></div>' +
      '<p class="sample-note">This is a sample profile with an illustrative photo. Health and compatibility fields are prompts to verify, not claims about this dog.</p>';
    $('#enquiry-form').reset();
    $('#enquiry-form').hidden = false;
    $('#enquiry-form button[type="submit"]').disabled = false;
    $('#enquiry-form [name="dog"]').value = id;
    setMessage($('#enquiry-message'), '');
    openDialog($('#dog-dialog'), '#dog-title');
  }

  function setMessage(node, message, error = false) {
    node.textContent = message;
    node.dataset.error = String(error);
  }

  async function submit(url, data) {
    const csrf = document.cookie.split('; ').find(entry => entry.startsWith('csrftoken='))?.split('=')[1] || '';
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrf},
      body: JSON.stringify(data)
    });
    let body;
    try { body = await response.json(); }
    catch { throw new Error('The shop is temporarily unavailable. Please try again.'); }
    if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
    return body;
  }

  $('#order-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (orderPending) return;
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const submittedCart = {...cart};
    const data = {...Object.fromEntries(new FormData(form)), items: Object.entries(submittedCart).map(([id, quantity]) => ({id: Number(id), quantity}))};
    if (!data.items.length) {
      setMessage($('#order-message'), 'Your bag is empty. Add something good before requesting an order.', true);
      return;
    }
    orderPending = true;
    button.disabled = true;
    setMessage($('#order-message'), 'Sending your request…');
    renderCart();
    try {
      const body = await submit('/api/orders/', data);
      // Preserve anything added after this request began, including after closing the bag.
      for (const [id, quantity] of Object.entries(submittedCart)) {
        if (!cart[id]) continue;
        cart[id] -= quantity;
        if (cart[id] <= 0) delete cart[id];
      }
      form.reset();
      form.hidden = true;
      renderCart();
      setMessage($('#order-message'), 'Request ' + body.reference + ' received (' + money(body.total) + '). The shop will confirm stock, delivery and payment instructions. No payment has been taken.');
      writeStored('good-dog-last-order', {reference: body.reference, email: data.email});
      const trackRef = $('#tracking-form [name="reference"]');
      const trackEmail = $('#tracking-form [name="email"]');
      if (trackRef && trackEmail) {
        trackRef.value = body.reference;
        trackEmail.value = data.email;
      }
      if (whatsappNumber) {
        const link = $('#whatsapp-contact');
        if (link) link.href = whatsappUrl('Hi Good Dog Club! I just placed order ' + body.reference + ' and would like help with it.');
      }
    } catch (error) {
      setMessage($('#order-message'), error.message || 'We couldn’t send your request. Please try again.', true);
    } finally {
      orderPending = false;
      button.disabled = false;
      renderCart();
      if ($('#cart-dialog').open && form.hidden) $('#cart-title').focus({preventScroll: true});
    }
  });

  $('#enquiry-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const submittedSession = enquirySession;
    const data = Object.fromEntries(new FormData(form));
    data.dog = Number(data.dog);
    button.disabled = true;
    setMessage($('#enquiry-message'), 'Sending your introduction…');
    try {
      const body = await submit('/api/enquiries/', data);
      if (enquirySession === submittedSession) {
        setMessage($('#enquiry-message'), body.message);
        form.hidden = true;
        if ($('#dog-dialog').open) $('#dog-title').focus({preventScroll: true});
      }
    } catch (error) {
      if (enquirySession === submittedSession) setMessage($('#enquiry-message'), error.message || 'We couldn’t send your enquiry. Please try again.', true);
    } finally {
      if (enquirySession === submittedSession) button.disabled = false;
    }
  });

  /* Site navigation is a real disclosure on small screens. */
  function closeMenu(restoreFocus = false) {
    $('#main-nav').classList.remove('is-open');
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    $('#menu-toggle').setAttribute('aria-label', 'Open menu');
    if (restoreFocus) $('#menu-toggle').focus();
  }
  $('#menu-toggle').addEventListener('click', () => {
    const open = $('#menu-toggle').getAttribute('aria-expanded') !== 'true';
    $('#main-nav').classList.toggle('is-open', open);
    $('#menu-toggle').setAttribute('aria-expanded', String(open));
    $('#menu-toggle').setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) $('#main-nav a').focus();
  });
  $('#main-nav').addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    closeMenu();
    const heading = $(link.getAttribute('href'))?.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      requestAnimationFrame(() => heading.focus({preventScroll: true}));
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#main-nav').classList.contains('is-open')) closeMenu(true);
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.site-header')) closeMenu();
    const mpesaPay = target.closest('[data-mpesa-pay]');
    if (mpesaPay && !mpesaPay.disabled) startMpesaPayment(mpesaPay.dataset.mpesaPay);
    const mpesaRefresh = target.closest('[data-mpesa-refresh]');
    if (mpesaRefresh) {
      const email = $('#tracking-form [name="email"]').value.trim();
      refreshTrackedOrder(mpesaRefresh.dataset.mpesaRefresh, email).catch(error => toast(error.message || 'Could not refresh payment.'));
    }
    const add = target.closest('[data-add]');
    if (add && !add.disabled) addToCart(Number(add.dataset.add));
    const boxChoice = target.closest('[data-box-product]');
    if (boxChoice) chooseBoxProduct(boxChoice.dataset.boxCategory, Number(boxChoice.dataset.boxProduct));
    const detailDelta = target.closest('[data-detail-delta]');
    if (detailDelta) {
      const qty = $('#detail-qty');
      const current = Number(qty.textContent) || 1;
      const productId = Number($('#product-detail [data-detail-add]')?.dataset.detailAdd);
      const product = productById.get(productId);
      qty.textContent = Math.max(1, Math.min(stockLimit(product), current + Number(detailDelta.dataset.detailDelta)));
    }
    const detailAdd = target.closest('[data-detail-add]');
    if (detailAdd && !detailAdd.disabled) addToCart(Number(detailAdd.dataset.detailAdd), Number($('#detail-qty')?.textContent) || 1);
    const saved = target.closest('[data-save]');
    if (saved) toggleFavorite(Number(saved.dataset.save));
    const product = target.closest('[data-product]');
    if (product) openProduct(Number(product.dataset.product));
    const dog = target.closest('[data-dog]');
    if (dog) openDog(Number(dog.dataset.dog));
    const filterButton = target.closest('[data-filter]');
    if (filterButton) setFilter(filterButton.dataset.filter);
    const category = target.closest('[data-category]');
    if (category) {
      $('#search').value = '';
      setFilter(category.dataset.category);
    }
    const quantity = target.closest('[data-qty]');
    if (quantity && !orderPending) {
      const id = quantity.dataset.qty;
      const product = productById.get(Number(id));
      if (!product || !cart[id]) return;
      const next = cart[id] + Number(quantity.dataset.delta);
      if (next > stockLimit(product)) {
        toast('That’s the maximum listed quantity.');
        return;
      }
      cart[id] = next;
      if (next <= 0) delete cart[id];
      renderCart({id, delta: quantity.dataset.delta});
    }
    const remove = target.closest('[data-remove]');
    if (remove && !orderPending) {
      const id = remove.dataset.remove;
      delete cart[id];
      renderCart({id, remove: true});
    }
    const close = target.closest('[data-close]');
    if (close) closeDialog(close.closest('dialog'));
    if (target.closest('[data-continue-shopping]')) {
      closeDialog($('#cart-dialog'), false);
      goToShop();
    }
  });

  $('#search').addEventListener('input', renderProducts);
  $('#sort').addEventListener('change', renderProducts);
  $('#size-filter').addEventListener('change', renderProducts);
  $('#stage-filter').addEventListener('change', renderProducts);
  $('#price-filter').addEventListener('change', renderProducts);
  $('#reset-shop').addEventListener('click', resetShop);
  $('#box-surprise').addEventListener('click', surpriseDogBox);
  $('#box-reset').addEventListener('click', resetDogBox);
  $('#box-add-all').addEventListener('click', addDogBoxToCart);
  $('#open-saved').addEventListener('click', () => goToShop('saved'));
  $('#open-cart').addEventListener('click', () => {
    renderCart();
    if (!orderPending) $('#order-form').hidden = true;
    openDialog($('#cart-dialog'), '#cart-title');
  });
  function syncDeliveryChoice() {
    const pickup = $('#delivery-method').value === 'pickup';
    const address = $('#address-label textarea');
    $('#address-label').hidden = pickup;
    address.required = !pickup;
    if (pickup && !address.value.trim()) address.value = 'Store pickup';
    if (!pickup && address.value === 'Store pickup') address.value = '';
    const cod = $('#order-form input[value="cod"]');
    cod.disabled = pickup;
    if (pickup && cod.checked) $('#order-form input[value="pickup"]').checked = true;
  }
  $('#delivery-method').addEventListener('change', syncDeliveryChoice);
  $('#checkout').addEventListener('click', () => {
    if (orderPending) return;
    $('#order-form').hidden = false;
    syncDeliveryChoice();
    setMessage($('#order-message'), '');
    $('#order-form input').focus();
  });



  function mpesaPaymentCard(order) {
    if (order.payment_method_code !== 'mpesa') return '';
    const payment = order.payment || {status:'not_started', status_label:'Not started', receipt:'', message:''};
    if (payment.status === 'paid') {
      return '<div class="mpesa-card paid"><div class="mpesa-card-head"><span class="mpesa-logo">M-PESA</span><strong>Payment received</strong></div>' +
        '<p>Your payment is confirmed.' + (payment.receipt ? ' Receipt: <b>' + esc(payment.receipt) + '</b>.' : '') + '</p></div>';
    }
    if (order.status === 'requested') {
      return '<div class="mpesa-card waiting"><div class="mpesa-card-head"><span class="mpesa-logo">M-PESA</span><strong>Waiting for shop confirmation</strong></div><p>The STK Push unlocks after the shop confirms stock and delivery.</p></div>';
    }
    if (!mpesaEnabled) {
      return '<div class="mpesa-card waiting"><div class="mpesa-card-head"><span class="mpesa-logo">M-PESA</span><strong>Payment setup pending</strong></div><p>This shop has not configured Daraja credentials yet.</p></div>';
    }
    if (payment.status === 'pending') {
      return '<div class="mpesa-card pending"><div class="mpesa-card-head"><span class="mpesa-logo">M-PESA</span><strong>Check your phone</strong></div><p>' + esc(payment.message || 'Enter your M-PESA PIN on the STK prompt to complete payment.') + '</p><button class="mpesa-refresh" data-mpesa-refresh="' + esc(order.reference) + '">Refresh payment status</button></div>';
    }
    const retry = payment.status === 'failed' || payment.status === 'cancelled';
    return '<div class="mpesa-card ready"><div class="mpesa-card-head"><span class="mpesa-logo">M-PESA</span><strong>' + (retry ? 'Try payment again' : 'Ready for payment') + '</strong></div>' +
      (payment.message ? '<p class="mpesa-last-message">' + esc(payment.message) + '</p>' : '<p>We’ll send an STK Push to the phone used at checkout. You can enter another Safaricom number below.</p>') +
      '<label class="mpesa-phone-label">M-PESA phone (optional)<input id="mpesa-phone" type="tel" inputmode="tel" placeholder="07XX XXX XXX"></label>' +
      '<button class="button mpesa-pay-button" data-mpesa-pay="' + esc(order.reference) + '">' + (retry ? 'Send another STK Push' : 'Send STK Push') + ' <span aria-hidden="true">→</span></button></div>';
  }

  async function refreshTrackedOrder(reference, email) {
    const tracked = await submit('/api/orders/track/', {reference, email});
    renderTracking(tracked);
    return tracked;
  }

  function beginMpesaPolling(reference, email, attempt = 0) {
    clearTimeout(mpesaPollTimer);
    if (attempt >= 15) return;
    mpesaPollTimer = setTimeout(async () => {
      try {
        const status = await submit('/api/payments/mpesa/status/', {reference, email});
        if (status.status === 'pending' || status.status === 'initiated') {
          beginMpesaPolling(reference, email, attempt + 1);
          return;
        }
        await refreshTrackedOrder(reference, email);
      } catch {
        beginMpesaPolling(reference, email, attempt + 1);
      }
    }, 4000);
  }

  async function startMpesaPayment(reference) {
    const email = $('#tracking-form [name="email"]').value.trim();
    const phone = $('#mpesa-phone')?.value.trim() || '';
    const button = $('[data-mpesa-pay="' + CSS.escape(reference) + '"]');
    if (button) button.disabled = true;
    try {
      const body = await submit('/api/payments/mpesa/initiate/', {reference, email, phone});
      await refreshTrackedOrder(reference, email);
      if (body.status === 'pending') beginMpesaPolling(reference, email);
    } catch (error) {
      toast(error.message || 'Could not start M-PESA payment.');
      await refreshTrackedOrder(reference, email).catch(() => {});
    } finally {
      const current = $('[data-mpesa-pay="' + CSS.escape(reference) + '"]');
      if (current) current.disabled = false;
    }
  }

  const trackingStages = [
    ['requested', 'Order requested'],
    ['confirmed', 'Confirmed'],
    ['preparing', 'Preparing'],
    ['out_for_delivery', 'Out for delivery'],
    ['completed', 'Completed']
  ];

  function trackingStepState(current, step) {
    if (current === 'cancelled') return step === 'requested' ? 'complete' : '';
    const currentIndex = trackingStages.findIndex(([key]) => key === current);
    const stepIndex = trackingStages.findIndex(([key]) => key === step);
    if (currentIndex === -1 || stepIndex === -1) return '';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'current';
    return '';
  }

  function renderTracking(order) {
    const cancelled = order.status === 'cancelled';
    const created = new Date(order.created_at);
    const items = order.items.map(item =>
      '<li><span>' + esc(item.quantity + ' × ' + item.name) + '</span><strong>' + money(Number(item.unit_price) * item.quantity) + '</strong></li>'
    ).join('');
    const timeline = trackingStages.map(([key, label]) =>
      '<div class="tracking-step ' + trackingStepState(order.status, key) + '"><span class="tracking-dot">' + icon('paw') + '</span><div><strong>' + esc(label) + '</strong><small>' + (key === order.status ? 'Current status' : '') + '</small></div></div>'
    ).join('');
    $('#tracking-result').hidden = false;
    $('#tracking-result').innerHTML =
      '<div class="tracking-result-head"><div><span class="eyebrow">ORDER ' + esc(order.reference) + '</span><h3>' + esc(cancelled ? 'This order was cancelled.' : order.status_label) + '</h3></div><span class="tracking-status-pill ' + (cancelled ? 'cancelled' : '') + '">' + esc(order.status_label) + '</span></div>' +
      '<p class="tracking-date">Placed ' + created.toLocaleString('en-KE', {dateStyle:'medium', timeStyle:'short'}) + '</p>' +
      (cancelled ? '<div class="tracking-cancelled">This order is marked cancelled. Contact the shop if you need help understanding what happened.</div>' : '<div class="tracking-timeline">' + timeline + '</div>') +
      '<div class="tracking-order-meta"><span><b>Delivery</b>' + esc(order.delivery_method) + '</span><span><b>Payment</b>' + esc(order.payment_method) + '</span><span><b>Total</b>' + money(order.total) + '</span></div>' +
      mpesaPaymentCard(order) +
      '<div class="tracking-items"><span class="eyebrow">IN THIS ORDER</span><ul>' + items + '</ul></div>' +
      (whatsappNumber ? '<a class="button whatsapp-button" href="' + esc(whatsappUrl('Hi Good Dog Club! I need help with order ' + order.reference + '.')) + '" target="_blank" rel="noopener noreferrer">Ask about this order on WhatsApp <span aria-hidden="true">↗</span></a>' : '<p class="muted">WhatsApp contact will appear here once the shop configures its business number.</p>');
  }

  $('#tracking-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    clearTimeout(mpesaPollTimer);
    setMessage($('#tracking-message'), 'Checking your order…');
    $('#tracking-result').hidden = true;
    try {
      const body = await submit('/api/orders/track/', Object.fromEntries(new FormData(form)));
      renderTracking(body);
      setMessage($('#tracking-message'), '');
    } catch (error) {
      setMessage($('#tracking-message'), error.message || 'We could not find that order.', true);
    } finally {
      button.disabled = false;
    }
  });

  const lastOrder = readStored('good-dog-last-order', null);
  if (lastOrder && typeof lastOrder === 'object') {
    const refInput = $('#tracking-form [name="reference"]');
    const emailInput = $('#tracking-form [name="email"]');
    if (refInput && emailInput) {
      refInput.value = typeof lastOrder.reference === 'string' ? lastOrder.reference : '';
      emailInput.value = typeof lastOrder.email === 'string' ? lastOrder.email : '';
    }
  }

  if (whatsappNumber) {
    const contact = $('#whatsapp-contact');
    if (contact) contact.href = whatsappUrl('Hi Good Dog Club! I have a question about your dogs or products.');
  }

  /* Manually switched portraits and a finite, keyboard-friendly little delight. */
  const portraits = [
    {image: 'portrait.jpg', alt: 'Corgi puppy with enormous ears against a bright orange background', caption: 'Small paws. Main-character energy.'},
    {image: 'pug.jpg', alt: 'Black pug wrapped in a cosy grey blanket on a yellow background', caption: 'Big feelings. Very small to-do list.'},
    {image: 'puppy.jpg', alt: 'Dog in a yellow hoodie looking back against a blue background', caption: 'Dressed for a very good day.'}
  ];
  $$('[data-portrait]').forEach(button => {
    button.addEventListener('click', () => {
      const portrait = portraits[Number(button.dataset.portrait)];
      $('#hero-photo').src = img('shop/images/' + portrait.image);
      $('#hero-photo').alt = portrait.alt;
      $('#hero-caption').textContent = portrait.caption;
      $('#hero-status').textContent = portrait.caption;
      $$('[data-portrait]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    });
  });
  $('#boop').addEventListener('click', () => {
    boopCount++;
    const messages = ['Boop received. You’re officially a dog person.', 'Another boop? Best day ever.', 'Maximum good-dog energy achieved.'];
    const message = messages[(boopCount - 1) % messages.length];
    $('#hero-status').textContent = message;
    $('#boop span').textContent = boopCount === 1 ? '1 very good boop' : boopCount + ' very good boops';
    if (!motionOff()) {
      const stage = $('#hero-stage');
      const burst = document.createElement('span');
      burst.className = 'boop-burst';
      burst.textContent = boopCount % 2 ? '♥' : '✳';
      burst.setAttribute('aria-hidden', 'true');
      burst.style.setProperty('--drift', (boopCount % 2 ? -40 : 40) + 'px');
      stage.append(burst);
      setTimeout(() => burst.remove(), 850);
    }
  });

  const facts = [
    {title: 'Sniff detectives.', text: 'Dogs use scent to explore their surroundings and gather information about other dogs. There’s a whole world behind that sniff.', source: 'https://www.akc.org/expert-advice/advice/why-does-my-dog-sniff-everything/'},
    {title: 'Read the whole dog.', text: 'A wagging tail can mean more than happiness. The ears, face and rest of the body help tell the story.', source: 'https://www.dogstrust.org.uk/dog-advice/understanding-your-dog/body-language'},
    {title: 'A different rainbow.', text: 'Dogs can see colour! Blues and yellows are easier for them to distinguish than reds and greens.', source: 'https://www.acvo.org/tips-treatments-tricks/vision-in-pets'},
    {title: 'An invitation to play.', text: 'Front paws down, bottom up: a play bow often invites another dog to join the fun.', source: 'https://www.dogstrust.org.uk/dog-advice/understanding-your-dog/body-language'}
  ];
  let factIndex = 0;
  $('#next-fact').addEventListener('click', () => {
    factIndex = (factIndex + 1) % facts.length;
    const fact = facts[factIndex];
    $('#fact-title').textContent = fact.title;
    $('#fact').textContent = fact.text;
    $('#fact-source').href = fact.source;
    $('#fact-count').textContent = String(factIndex + 1).padStart(2, '0') + ' / ' + String(facts.length).padStart(2, '0');
    $$('.fact-dots span').forEach((dot, index) => dot.classList.toggle('active', index === factIndex));
  });

  const questions = [
    ['Your perfect Saturday?', ['A long walk and a new trail', 'A blanket and a good film', 'Friends, games and a busy afternoon']],
    ['Pick a little everyday joy.', ['Fresh air before breakfast', 'A quiet moment together', 'An impromptu play break']],
    ['Your ideal sidekick energy?', ['Always up for adventure', 'Happy to take things slowly', 'A little bundle of mischief']]
  ];
  const results = [
    {title: 'The adventure duo.', text: 'You make room for fresh air, curious noses and shared adventures. Explore walk essentials for your next outing.', category: 'accessories', image: 'running.jpg', alt: 'Two dogs enjoying a run outdoors'},
    {title: 'The cosy companions.', text: 'You appreciate a slow morning and a soft landing. Explore beds and care for those well-earned rest days.', category: 'care', image: 'pug.jpg', alt: 'Pug snuggled in a grey blanket'},
    {title: 'The playtime pals.', text: 'Your kind of happiness has a little mischief in it. Explore toys for a shared play break.', category: 'toys', image: 'portrait.jpg', alt: 'Corgi puppy with a curious expression'}
  ];
  let quizStep = 0;
  let answers = [];
  function focusQuizTitle() {
    $('#quiz-title')?.focus({preventScroll: true});
  }
  function renderQuiz(focus = true) {
    const body = $('#quiz-body');
    if (quizStep === questions.length) {
      const counts = [0, 0, 0];
      answers.forEach(answer => counts[answer]++);
      const result = results[counts.indexOf(Math.max(...counts))];
      body.innerHTML = '<img class="quiz-result-art" src="' + img('shop/images/' + result.image) + '" alt="' + result.alt + '">' +
        '<span class="eyebrow">YOUR VIBE IS…</span><h2 id="quiz-title" tabindex="-1">' + result.title + '</h2><p class="quiz-result-description">' + result.text + '</p>' +
        '<p class="sample-note">Just for fun. Every dog has individual needs; this quiz does not determine breed suitability.</p><div class="quiz-result-actions"><button class="button dark" id="quiz-shop">Explore my edit ' + icon('arrow') + '</button><button class="button outline" id="quiz-restart">Play again</button></div>';
      $('#quiz-shop').addEventListener('click', () => {
        closeDialog($('#quiz-dialog'), false);
        goToShop(result.category);
      });
      $('#quiz-restart').addEventListener('click', () => startQuiz());
    } else {
      body.innerHTML = '<div class="quiz-progress" aria-hidden="true">' + questions.map((_, index) => '<span' + (index <= quizStep ? ' class="complete"' : '') + '></span>').join('') + '</div>' +
        '<p class="quiz-question-number">Question ' + (quizStep + 1) + ' of ' + questions.length + '</p><h2 id="quiz-title" tabindex="-1">' + questions[quizStep][0] + '</h2>' +
        questions[quizStep][1].map((answer, index) => '<button class="quiz-option" data-answer="' + index + '">' + answer + icon('arrow') + '</button>').join('') +
        (quizStep ? '<button class="quiz-back" id="quiz-back">← Previous question</button>' : '');
      body.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
        answers.push(Number(button.dataset.answer));
        quizStep++;
        renderQuiz();
      }));
      $('#quiz-back')?.addEventListener('click', () => {
        answers.pop();
        quizStep--;
        renderQuiz();
      });
    }
    if (focus && $('#quiz-dialog').open) focusQuizTitle();
  }
  function startQuiz(focus = true) {
    quizStep = 0;
    answers = [];
    renderQuiz(focus);
  }
  $('#open-quiz').addEventListener('click', () => {
    startQuiz(false);
    openDialog($('#quiz-dialog'), '#quiz-title');
  });

  /* Content is visible before JS runs, even if observers are unavailable. */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (!motionOff()) entry.target.classList.add('reveal-in');
        observer.unobserve(entry.target);
      }
    }, {threshold: 0.12});
    $$('.section-heading, .adventure-banner, .story-copy').forEach(node => observer.observe(node));
  }

  saveCart();
  syncSavedButtons();
  renderProducts();
  renderDogBox();
  renderDogs();
})();
