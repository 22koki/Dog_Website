# Good Dog Club

Colorful Django storefront with dog profiles, food, toys, accessories and beds; product search, filters, sorting, a persistent basket, order requests, enquiries, fun facts and a personality quiz.

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

Seeded listings, prices, illustrations and dog profiles are samples. Replace with real inventory before launch. The repeatable seed command preserves existing entries.

Orders are requests awaiting staff confirmation. Prices are calculated by the server. Requests do not reserve inventory, charge money or automatically send notifications. Staff must confirm availability, delivery and payment. Dog enquiries are saved for staff review.

## Validation

Eight backend tests passed: rendering, authoritative pricing, invalid baskets, unavailable listings, enquiries, CSRF and repeatable seed data. Django system and migration checks and JavaScript syntax checks passed. Browser verification was unavailable because the managed preview relay was not running.

Run tests with your environment Python: `python dog-website/manage.py test shop`.

## Production setup

Configure DJANGO_SECRET_KEY, DJANGO_DEBUG=0, DJANGO_ALLOWED_HOSTS and CSRF_TRUSTED_ORIGINS. Use HTTPS, a production WSGI server, persistent database storage and static serving after collectstatic. Configure live payment/shipping/notification services and abuse prevention before public launch.

## Images

Dog photographs downloaded from Unsplash image IDs: photo-1552053831-71594a27632d, photo-1517849845537-4d257902454a, photo-1583337130417-3346a1be7dee, photo-1548199973-03cce0bbc87b and photo-1537151625747-768eb6cf92b2. Original SVG illustrations represent sample products. Fonts: Google Fonts DM Sans and Manrope with system fallbacks.
