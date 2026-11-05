import json
from decimal import Decimal
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.conf import settings
from .models import Product, Dog, Order, OrderItem, Enquiry

@ensure_csrf_cookie
def home(request):
    products = list(Product.objects.filter(active=True).order_by('id').values())
    dogs = list(Dog.objects.filter(available=True).order_by('id').values())
    whatsapp_number = ''.join(ch for ch in getattr(settings, 'GOOD_DOG_WHATSAPP_NUMBER', '') if ch.isdigit())
    return render(request, 'shop/index.html', {'catalog': {'products': products, 'dogs': dogs}, 'whatsapp_number': whatsapp_number})

def payload(request):
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict): raise ValueError()
        return data
    except (ValueError, UnicodeDecodeError): raise ValueError('Please send a valid request.')

def field(data, key, limit):
    value = data.get(key, '')
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise ValueError(f'Please enter a valid {key} (up to {limit} characters).')
    return value.strip()

def contact(data):
    name, email = field(data, 'name', 100), field(data, 'email', 254)
    try: validate_email(email)
    except ValidationError: raise ValueError('Please enter a valid email address.')
    return name, email

@require_POST
def order(request):
    try:
        data = payload(request)
        name, email = contact(data)
        phone = field(data, 'phone', 30)
        delivery_method = data.get('delivery_method', 'delivery')
        payment_method = data.get('payment_method', 'mpesa')
        notes = data.get('notes', '')
        if delivery_method not in {'delivery', 'pickup'}: raise ValueError('Please choose a valid delivery method.')
        address = 'Store pickup' if delivery_method == 'pickup' else field(data, 'address', 600)
        if payment_method not in {'mpesa', 'cod', 'pickup'}: raise ValueError('Please choose a valid payment method.')
        if not isinstance(notes, str) or len(notes.strip()) > 600: raise ValueError('Order notes must be 600 characters or fewer.')
        if delivery_method == 'pickup' and payment_method == 'cod': raise ValueError('Cash on delivery is only available for delivery orders.')
        items = data.get('items')
        if not isinstance(items, list) or not 1 <= len(items) <= 50: raise ValueError('Your basket must contain 1–50 different items.')
        quantities = {}
        for item in items:
            if not isinstance(item, dict) or type(item.get('id')) is not int or type(item.get('quantity')) is not int: raise ValueError('Invalid basket item.')
            pid, qty = item['id'], item['quantity']
            if not 1 <= qty <= 99 or pid in quantities: raise ValueError('Invalid item quantity.')
            quantities[pid] = qty
        with transaction.atomic():
            products = list(Product.objects.filter(id__in=quantities, active=True))
            if len(products) != len(quantities): raise ValueError('An item is no longer available. Please refresh your basket.')
            total = Decimal('0')
            for product in products:
                if quantities[product.id] > product.stock: raise ValueError(f'Only {product.stock} of {product.name} are currently listed. Please update your basket.')
                total += product.price * quantities[product.id]
            order = Order.objects.create(name=name, email=email, phone=phone, address=address, delivery_method=delivery_method, payment_method=payment_method, notes=notes.strip(), total=total)
            OrderItem.objects.bulk_create([OrderItem(order=order, product=p, name=p.name, quantity=quantities[p.id], unit_price=p.price) for p in products])
        return JsonResponse({'reference': f'GDC-{order.id:05d}', 'total': str(total), 'delivery_method': order.delivery_method, 'payment_method': order.payment_method}, status=201)
    except ValueError as exc: return JsonResponse({'error': str(exc)}, status=400)

@require_POST
def enquiry(request):
    try:
        data = payload(request)
        name, email = contact(data)
        message = field(data, 'message', 2000)
        if type(data.get('dog')) is not int: raise ValueError('Please select a dog.')
        dog = Dog.objects.filter(pk=data['dog'], available=True).first()
        if not dog: raise ValueError('This dog is no longer listed.')
        Enquiry.objects.create(dog=dog, name=name, email=email, message=message)
        return JsonResponse({'message': 'Enquiry received. The team can now review your introduction.'}, status=201)
    except ValueError as exc: return JsonResponse({'error': str(exc)}, status=400)


@require_POST
def track_order(request):
    try:
        data = payload(request)
        reference = field(data, 'reference', 30).upper()
        email = field(data, 'email', 254)
        try: validate_email(email)
        except ValidationError: raise ValueError('Please enter a valid email address.')
        if not reference.startswith('GDC-') or not reference[4:].isdigit():
            raise ValueError('We could not find an order matching those details.')
        order_id = int(reference[4:])
        order = Order.objects.prefetch_related('items').filter(pk=order_id, email__iexact=email).first()
        if not order:
            raise ValueError('We could not find an order matching those details.')
        return JsonResponse({
            'reference': f'GDC-{order.id:05d}',
            'status': order.status,
            'status_label': order.get_status_display(),
            'created_at': order.created_at.isoformat(),
            'total': str(order.total),
            'delivery_method': order.get_delivery_method_display(),
            'payment_method': order.get_payment_method_display(),
            'items': [{'name': item.name, 'quantity': item.quantity, 'unit_price': str(item.unit_price)} for item in order.items.all()],
        })
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
