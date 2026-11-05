import base64
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from decimal import Decimal, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone


class MpesaError(Exception):
    pass


def configured():
    required = [
        settings.MPESA_CONSUMER_KEY,
        settings.MPESA_CONSUMER_SECRET,
        settings.MPESA_SHORTCODE,
        settings.MPESA_PASSKEY,
        settings.MPESA_CALLBACK_URL,
        settings.MPESA_CALLBACK_TOKEN,
    ]
    return all(str(value).strip() for value in required)


def base_url():
    return 'https://api.safaricom.co.ke' if settings.MPESA_ENVIRONMENT == 'production' else 'https://sandbox.safaricom.co.ke'


def normalize_phone(value):
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
    if digits.startswith('0') and len(digits) == 10:
        digits = '254' + digits[1:]
    elif len(digits) == 9 and digits[0] in {'1', '7'}:
        digits = '254' + digits
    if not (digits.startswith('254') and len(digits) == 12 and digits[3] in {'1', '7'}):
        raise MpesaError('Enter a valid Kenyan Safaricom mobile number.')
    return digits


def request_json(url, *, headers=None, data=None, method=None, timeout=20):
    request = Request(
        url,
        headers=headers or {},
        data=json.dumps(data).encode('utf-8') if data is not None else None,
        method=method,
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read().decode('utf-8')
            return json.loads(raw or '{}')
    except HTTPError as exc:
        try:
            body = json.loads(exc.read().decode('utf-8') or '{}')
            message = body.get('errorMessage') or body.get('ResponseDescription') or body.get('error_description')
        except Exception:
            message = None
        raise MpesaError(message or 'M-PESA rejected the request.') from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise MpesaError('Could not reach M-PESA. Please try again.') from exc


def access_token():
    if not configured():
        raise MpesaError('M-PESA is not configured on this server.')
    basic = base64.b64encode(
        f'{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}'.encode('utf-8')
    ).decode('ascii')
    body = request_json(
        base_url() + '/oauth/v1/generate?grant_type=client_credentials',
        headers={'Authorization': 'Basic ' + basic},
        method='GET',
    )
    token = body.get('access_token')
    if not token:
        raise MpesaError('M-PESA did not return an access token.')
    return token


def stk_push(order, phone):
    if not configured():
        raise MpesaError('M-PESA is not configured on this server.')
    phone = normalize_phone(phone)
    timestamp = datetime.now(ZoneInfo('Africa/Nairobi')).strftime('%Y%m%d%H%M%S')
    password = base64.b64encode(
        f'{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}'.encode('utf-8')
    ).decode('ascii')
    amount = int(Decimal(order.total).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    if amount < 1:
        raise MpesaError('The M-PESA amount must be at least KSh 1.')

    payload = {
        'BusinessShortCode': str(settings.MPESA_SHORTCODE),
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': settings.MPESA_TRANSACTION_TYPE,
        'Amount': amount,
        'PartyA': phone,
        'PartyB': str(settings.MPESA_SHORTCODE),
        'PhoneNumber': phone,
        'CallBackURL': settings.MPESA_CALLBACK_URL,
        'AccountReference': f'GDC-{order.id:05d}'[:12],
        'TransactionDesc': f'Good Dog order GDC-{order.id:05d}'[:13],
    }
    body = request_json(
        base_url() + '/mpesa/stkpush/v1/processrequest',
        headers={
            'Authorization': 'Bearer ' + access_token(),
            'Content-Type': 'application/json',
        },
        data=payload,
        method='POST',
    )
    if str(body.get('ResponseCode', '')) != '0':
        raise MpesaError(body.get('ResponseDescription') or body.get('errorMessage') or 'M-PESA could not start the payment.')
    return body, phone


def callback_metadata(callback):
    result = {}
    for item in callback.get('CallbackMetadata', {}).get('Item', []) or []:
        if isinstance(item, dict) and item.get('Name'):
            result[item['Name']] = item.get('Value')
    return result


def parse_transaction_date(value):
    if value in (None, ''):
        return None
    try:
        parsed = datetime.strptime(str(value), '%Y%m%d%H%M%S')
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    except (ValueError, TypeError):
        return None
