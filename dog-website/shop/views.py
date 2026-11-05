import json
import secrets
from decimal import Decimal
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from .models import Product, Dog, Order, OrderItem, Enquiry, MpesaPayment
from .mpesa import MpesaError, stk_push, callback_metadata, parse_transaction_date, configured as mpesa_configured

@ensure_csrf_cookie
def home(request):
    products = list(Product.objects.filter(active=True).order_by('id').values())
    dogs = list(Dog.objects.filter(available=True).order_by('id').values())
    whatsapp_number = ''.join(ch for ch in getattr(settings, 'GOOD_DOG_WHATSAPP_NUMBER', '') if ch.isdigit())
    return render(request, 'shop/index.html', {'catalog': {'products': products, 'dogs': dogs}, 'whatsapp_number': whatsapp_number, 'mpesa_enabled': mpesa_configured()})

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


def order_from_reference_email(data):
    reference = field(data, 'reference', 30).upper()
    email = field(data, 'email', 254)
    try: validate_email(email)
    except ValidationError: raise ValueError('Please enter a valid email address.')
    if not reference.startswith('GDC-') or not reference[4:].isdigit():
        raise ValueError('We could not find an order matching those details.')
    order = Order.objects.filter(pk=int(reference[4:]), email__iexact=email).first()
    if not order:
        raise ValueError('We could not find an order matching those details.')
    return order


def payment_payload(order):
    try:
        payment = order.mpesa_payment
    except MpesaPayment.DoesNotExist:
        return {'status': 'not_started', 'status_label': 'Not started', 'receipt': '', 'message': ''}
    return {
        'status': payment.status,
        'status_label': payment.get_status_display(),
        'receipt': payment.receipt,
        'message': payment.result_message,
    }


@require_POST
def track_order(request):
    try:
        data = payload(request)
        order = order_from_reference_email(data)
        order = Order.objects.prefetch_related('items').get(pk=order.pk)
        return JsonResponse({
            'reference': f'GDC-{order.id:05d}',
            'status': order.status,
            'status_label': order.get_status_display(),
            'created_at': order.created_at.isoformat(),
            'total': str(order.total),
            'delivery_method': order.get_delivery_method_display(),
            'payment_method': order.get_payment_method_display(),
            'payment': payment_payload(order),
            'items': [{'name': item.name, 'quantity': item.quantity, 'unit_price': str(item.unit_price)} for item in order.items.all()],
        })
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)


@require_POST
def initiate_mpesa(request):
    try:
        data = payload(request)
        order = order_from_reference_email(data)
        if order.payment_method != 'mpesa':
            raise ValueError('This order was not set to M-PESA.')
        if order.status not in {'confirmed', 'preparing', 'out_for_delivery'}:
            if order.status == 'requested':
                raise ValueError('M-PESA payment unlocks after the shop confirms this order.')
            raise ValueError('This order is not currently eligible for M-PESA payment.')
        phone = data.get('phone') or order.phone
        if not isinstance(phone, str) or len(phone.strip()) > 30:
            raise ValueError('Please enter a valid M-PESA phone number.')

        payment, _ = MpesaPayment.objects.get_or_create(
            order=order,
            defaults={'phone': phone.strip(), 'amount': order.total},
        )
        if payment.status == 'paid':
            return JsonResponse({'reference': f'GDC-{order.id:05d}', **payment_payload(order)})
        if payment.status == 'pending' and payment.checkout_request_id:
            return JsonResponse({'reference': f'GDC-{order.id:05d}', **payment_payload(order)})

        payment.phone = phone.strip()
        payment.amount = order.total
        payment.status = 'initiated'
        payment.result_code = ''
        payment.result_message = ''
        payment.receipt = ''
        payment.completed_at = None
        payment.raw_callback = {}
        payment.save()

        try:
            response, normalized_phone = stk_push(order, phone)
        except MpesaError as exc:
            payment.status = 'failed'
            payment.result_message = str(exc)
            payment.completed_at = timezone.now()
            payment.save(update_fields=['status', 'result_message', 'completed_at'])
            return JsonResponse({'error': str(exc), 'payment_status': 'failed'}, status=503)

        payment.phone = normalized_phone
        payment.status = 'pending'
        payment.merchant_request_id = str(response.get('MerchantRequestID', ''))
        payment.checkout_request_id = str(response.get('CheckoutRequestID', ''))
        payment.result_message = str(response.get('CustomerMessage') or response.get('ResponseDescription') or 'STK Push sent.')
        payment.save(update_fields=['phone', 'status', 'merchant_request_id', 'checkout_request_id', 'result_message'])
        return JsonResponse({
            'reference': f'GDC-{order.id:05d}',
            **payment_payload(order),
        }, status=201)
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)


@require_POST
def mpesa_status(request):
    try:
        order = order_from_reference_email(payload(request))
        if order.payment_method != 'mpesa':
            raise ValueError('This order was not set to M-PESA.')
        return JsonResponse({'reference': f'GDC-{order.id:05d}', **payment_payload(order)})
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)


@csrf_exempt
@require_POST
def mpesa_callback(request, token):
    expected = getattr(settings, 'MPESA_CALLBACK_TOKEN', '')
    if not expected or not secrets.compare_digest(token, expected):
        return JsonResponse({'error': 'Not found.'}, status=404)
    try:
        data = json.loads(request.body or b'{}')
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'ResultCode': 1, 'ResultDesc': 'Invalid callback.'}, status=400)

    callback = data.get('Body', {}).get('stkCallback', {})
    checkout_request_id = str(callback.get('CheckoutRequestID', ''))
    payment = MpesaPayment.objects.select_related('order').filter(checkout_request_id=checkout_request_id).first()
    if not payment:
        return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})

    result_code = str(callback.get('ResultCode', ''))
    result_message = str(callback.get('ResultDesc', ''))[:300]
    payment.raw_callback = data
    payment.result_code = result_code
    payment.result_message = result_message

    if result_code == '0':
        metadata = callback_metadata(callback)
        try:
            paid_amount = Decimal(str(metadata.get('Amount')))
        except Exception:
            paid_amount = Decimal('-1')
        if paid_amount != payment.amount:
            payment.status = 'failed'
            payment.result_message = 'Payment callback amount did not match the order total.'
        else:
            payment.status = 'paid'
            payment.receipt = str(metadata.get('MpesaReceiptNumber', ''))[:80]
            payment.completed_at = parse_transaction_date(metadata.get('TransactionDate')) or timezone.now()
    else:
        payment.status = 'cancelled' if result_code == '1032' else 'failed'
        payment.completed_at = timezone.now()

    payment.save(update_fields=['status', 'receipt', 'result_code', 'result_message', 'completed_at', 'raw_callback'])
    return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})
