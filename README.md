# Good Dog Club

A playful Django storefront for dogs and their people: dog profiles, food, toys, accessories and beds, with a sunshine-yellow, plum, coral and lavender design.

## The new storefront

- Oversized headlines, a layered dog-photo hero, clickable portrait selectors and a small “boop the snoot” interaction.
- Photograph-led category tiles, a walk-and-wag feature, a plum dog showcase and a scrollable photo moodboard on phones.
- Product search, category, dog-size, life-stage and price controls, richer product details, related-product suggestions, saved favourites and a persistent shopping bag. Favourites and the bag are saved in this browser; no account is required.
- An interactive Build My Dog Box experience lets shoppers choose food, play, care and walk items, see a live total, use a Surprise Me picker, persist the box locally and add the completed bundle to the existing bag in one click.
- Richer sample dog profiles with compatibility/health verification prompts, plus detailed enquiry dialogs.
- A cart free-delivery progress meter, add-on recommendations and a checkout request flow with delivery/pickup and payment-preference choices.
- Clearly labelled demo review cards for storefront design; replace them with verified customer reviews before launch.
- Responsive mobile navigation and accessible dialogs throughout.
- Source-linked fun facts and a three-question personality quiz with a back button and a matching collection.
- Keyboard navigation, named native dialogs, focus restoration and a motion-pause control. Device reduced-motion preferences take priority.

The storefront uses bundled photographs of real dogs, dog food, chew toys, a tennis ball, a leather lead, a cushioned bed and a ceramic bowl. Product photos appear in collection tiles, product cards, product details and the shopping bag. The expanded checkout adds a Django migration for delivery method, payment preference and optional order notes; it adds no new dependency or frontend build step.

Existing demo catalogues automatically display the new photographs even when their saved image paths still refer to the original six SVG illustrations. Custom image paths are preserved; there is no need to reseed or recreate products. New demo catalogues use the photograph paths directly.

## Windows setup

Run from the repository root in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r dog-website\requirements.txt
.\.venv\Scripts\python.exe dog-website\manage.py migrate
.\.venv\Scripts\python.exe dog-website\manage.py seed_demo
.\.venv\Scripts\python.exe dog-website\manage.py runserver
```

Open http://127.0.0.1:8000. No Node or PostgreSQL needed. On Linux/macOS use python3 and .venv/bin/python.

Create a staff login using manage.py createsuperuser, then manage products, dogs, orders and enquiries at /admin/. Image fields accept static paths such as shop/images/golden.jpg.

Seeded listings, prices and dog profiles are samples. The real product photographs are representative images for the sample catalogue. Replace the listings and photographs with your actual inventory before launch. The repeatable seed command preserves existing entries.

Orders are requests awaiting staff confirmation. Prices are calculated by the server. Customers can choose delivery or pickup and select M-PESA-after-confirmation, cash-on-delivery or pay-on-pickup where appropriate. These are payment preferences only: the site does not send an M-PESA STK push, reserve inventory, charge money or automatically send notifications. Staff must confirm availability, delivery and payment. Dog enquiries are saved for staff review.

## Validation

The store-experience revision extends backend coverage to checkout delivery/payment validation while retaining rendering, authoritative pricing, invalid-basket, unavailable-listing, enquiry, CSRF and repeatable-seed tests. Run the test command below after pulling the branch.

The new JPEG files were decoded and visually inspected. JavaScript syntax, the six legacy-to-photo path mappings, custom-path preservation and static asset references were checked. Browser rendering could not be completed: the editing environment blocks Chromium's local sockets, and its automatic approval policy rejected the required additional permissions. Desktop/mobile screenshot verification remains outstanding; source checks do not replace a browser review.

Run tests with your environment Python: `python dog-website/manage.py test shop`.

To review the design locally, use the setup above and check the homepage on desktop and at a phone width. Try the mobile menu, hero photo buttons, motion control, product search, saved favourites, quick views, basket quantities, order request, dog enquiry, fact carousel and quiz. Use Tab and Escape in the dialogs. The sample labels and manual-confirmation order flow remain intentional.

## Production setup

Configure DJANGO_SECRET_KEY, DJANGO_DEBUG=0, DJANGO_ALLOWED_HOSTS and CSRF_TRUSTED_ORIGINS. Use HTTPS, a production WSGI server, persistent database storage and static serving after collectstatic. Configure live payment/shipping/notification services and abuse prevention before public launch.

## Images

Dog photographs downloaded from Unsplash image IDs: photo-1552053831-71594a27632d, photo-1517849845537-4d257902454a, photo-1583337130417-3346a1be7dee, photo-1548199973-03cce0bbc87b and photo-1537151625747-768eb6cf92b2.

The six product photographs are bundled under `dog-website/shop/static/shop/images/products/` and total less than 1 MB. Photographer credits, original source links and image licences are recorded in [Photo credits](dog-website/shop/static/shop/photo-credits.html), also linked from the storefront footer. The leather-lead photograph by Kristina.averina retains its CC BY-SA 4.0 licence; the other product photos use the Pexels or Unsplash licence listed on that page.

Fonts: Google Fonts DM Sans and Manrope with system fallbacks.

## Fun-fact sources

Carousel entries include a source link to the underlying guidance:

- [AKC: why dogs sniff](https://www.akc.org/expert-advice/advice/why-does-my-dog-sniff-everything/)
- [American College of Veterinary Ophthalmologists: canine colour vision](https://www.acvo.org/tips-treatments-tricks/vision-in-pets)
- [Dogs Trust: tail signals, body language and the play bow](https://www.dogstrust.org.uk/dog-advice/understanding-your-dog/body-language)
