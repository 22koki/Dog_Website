from django.core.management.base import BaseCommand
from shop.models import Product, Dog
class Command(BaseCommand):
    help = 'Create clearly illustrative sample products and dog profiles; never overwrite existing entries.'
    def handle(self, *args, **options):
        products = [
            ('Everyday crunch', 'food', 'A little bowl of happiness · 2 kg', 1800, 'products/food.jpg', 'The everyday favourite'),
            ('The happy chew', 'toys', 'A bouncy buddy for playtime', 650, 'products/chew.jpg', 'Playtime essential'),
            ('Zoomie tennis ball', 'toys', 'Ready. Set. Fetch! · Single ball', 350, 'products/ball.jpg', 'For the fetch obsessed'),
            ('Adventure leash', 'accessories', 'For walks with a little extra personality', 1200, 'products/leash.jpg', 'Out & about'),
            ('Cloud nine bed', 'care', 'A cosy spot for the chief nap officer', 4500, 'products/bed.jpg', 'Nap approved'),
            ('The good bowl', 'care', 'A cheerful place for the daily crunch', 950, 'products/bowl.jpg', 'Dinner is served'),
        ]
        for name,category,description,price,image,badge in products:
            Product.objects.get_or_create(name=name,defaults=dict(category=category,description=description,price=price,image='shop/images/'+image,badge=badge))
        for name,breed,age,personality,price,image,description in [
            ('Sunny','Golden Retriever','8 months','The sunshine soul',45000,'golden.jpg','A sample profile for a friendly, energetic companion. Ask about daily exercise, training, health history and the home they have grown up in.'),
            ('Milo','Pug','1 year','The sofa sidekick',35000,'pug.jpg','A sample profile for a small companion with a big personality. Discuss individual health and breathing needs, routine and temperament with the seller and a vet.'),
            ('Coco','Mixed breed','5 months','The curious little explorer',15000,'puppy.jpg','A sample profile for an inquisitive young dog. Meet in person and ask about socialisation, expected adult size, health records and ongoing care.'),
        ]:
            Dog.objects.get_or_create(name=name,defaults=dict(breed=breed,age=age,personality=personality,price=price,image='shop/images/'+image,description=description))
        self.stdout.write(self.style.SUCCESS('Sample collection ready. Replace sample listings before accepting real sales.'))
