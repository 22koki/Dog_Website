from django.db import models
from django.core.validators import MinValueValidator

class Product(models.Model):
    CATEGORIES = [('food', 'Food & treats'), ('toys', 'Toys & play'), ('accessories', 'Walk & wear'), ('care', 'Beds & care')]
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORIES)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    image = models.CharField(max_length=250, help_text='Static image path, e.g. shop/images/toy.jpg')
    badge = models.CharField(max_length=40, blank=True)
    stock = models.PositiveIntegerField(default=20)
    active = models.BooleanField(default=True)
    def __str__(self): return self.name

class Dog(models.Model):
    name = models.CharField(max_length=80)
    breed = models.CharField(max_length=100)
    age = models.CharField(max_length=60)
    personality = models.CharField(max_length=160)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    image = models.CharField(max_length=250)
    available = models.BooleanField(default=True)
    def __str__(self): return self.name

class Order(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=30)
    address = models.TextField(max_length=600)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=30, choices=[('requested', 'Awaiting confirmation'), ('confirmed', 'Confirmed'), ('completed', 'Completed'), ('cancelled', 'Cancelled')], default='requested')
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return f'Order #{self.pk} — {self.name}'

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

class Enquiry(models.Model):
    dog = models.ForeignKey(Dog, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    email = models.EmailField()
    message = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return f'{self.name} — {self.dog.name}'
