import json
from unittest.mock import patch
from django.test import TestCase, Client, override_settings
from django.core.management import call_command
from .models import Product, Dog, Order, Enquiry, MpesaPayment

class StoreTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.product = Product.objects.create(name='Test toy', category='toys', description='Toy', price='650.00', stock=2, image='shop/images/toy.svg')
        cls.dog = Dog.objects.create(name='Sunny', breed='Retriever', age='8 months', personality='Friendly', description='Sample', price=45000, image='shop/images/golden.jpg')
    def order_data(self, **extra):
        return {'name':'Test Customer','email':'test@example.com','phone':'0700000000','address':'Nairobi','delivery_method':'delivery','payment_method':'mpesa','notes':'Gate B','items':[{'id':self.product.id,'quantity':2}],**extra}
    def post_order(self,data): return self.client.post('/api/orders/', data=json.dumps(data), content_type='application/json')
    def test_home(self):
        response = self.client.get('/')
        self.assertContains(response, 'Life’s better')
        self.assertContains(response, 'catalog-data')
        self.assertIn('csrftoken',response.cookies)
    def test_server_calculates_order_price(self):
        response=self.post_order(self.order_data(total='1.00'))
        self.assertEqual(response.status_code,201)
        order=Order.objects.get()
        self.assertEqual(str(order.total),'1300.00')
        self.assertEqual(order.items.get().quantity,2)
        self.assertEqual(order.status,'requested')
        self.assertEqual(order.delivery_method,'delivery')
        self.assertEqual(order.payment_method,'mpesa')
        self.assertEqual(order.notes,'Gate B')
    def test_reject_invalid_baskets_without_creating_orders(self):
        for items in [[],[{'id':self.product.id,'quantity':3}],[{'id':self.product.id,'quantity':-1}],[{'id':99999,'quantity':1}],[{'id':self.product.id,'quantity':True}],[{'id':self.product.id,'quantity':1}]*2]:
            with self.subTest(items=items): self.assertEqual(self.post_order(self.order_data(items=items)).status_code,400)
        self.assertFalse(Order.objects.exists())
    def test_invalid_checkout_choices(self):
        self.assertEqual(self.post_order(self.order_data(delivery_method='teleport')).status_code,400)
        self.assertEqual(self.post_order(self.order_data(payment_method='crypto')).status_code,400)
        self.assertEqual(self.post_order(self.order_data(delivery_method='pickup',payment_method='cod')).status_code,400)
        self.assertFalse(Order.objects.exists())
    def test_order_tracking_requires_matching_reference_and_email(self):
        created=self.post_order(self.order_data())
        self.assertEqual(created.status_code,201)
        reference=created.json()['reference']
        ok=self.client.post('/api/orders/track/',data=json.dumps({'reference':reference,'email':'test@example.com'}),content_type='application/json')
        self.assertEqual(ok.status_code,200)
        self.assertEqual(ok.json()['status'],'requested')
        self.assertEqual(ok.json()['items'][0]['quantity'],2)
        self.assertNotIn('address',ok.json())
        bad=self.client.post('/api/orders/track/',data=json.dumps({'reference':reference,'email':'other@example.com'}),content_type='application/json')
        self.assertEqual(bad.status_code,400)
        malformed=self.client.post('/api/orders/track/',data=json.dumps({'reference':'GDC-NOPE','email':'test@example.com'}),content_type='application/json')
        self.assertEqual(malformed.status_code,400)
    def test_extended_order_statuses(self):
        order=Order.objects.create(name='Test',email='test@example.com',phone='0700',address='Nairobi',total='10.00',status='preparing')
        self.assertEqual(order.get_status_display(),'Preparing')
        order.status='out_for_delivery';order.save()
        self.assertEqual(order.get_status_display(),'Out for delivery')

    @override_settings(
        MPESA_CONSUMER_KEY='key', MPESA_CONSUMER_SECRET='secret',
        MPESA_SHORTCODE='174379', MPESA_PASSKEY='passkey',
        MPESA_CALLBACK_URL='https://example.com/api/payments/mpesa/callback/callback-secret/',
        MPESA_CALLBACK_TOKEN='callback-secret', MPESA_ENVIRONMENT='sandbox',
        MPESA_TRANSACTION_TYPE='CustomerPayBillOnline',
    )
    @patch('shop.views.stk_push')
    def test_mpesa_stk_success_callback_and_status(self, mocked_stk):
        created=self.post_order(self.order_data())
        reference=created.json()['reference']
        mocked_stk.return_value=({
            'ResponseCode':'0','MerchantRequestID':'merchant-1',
            'CheckoutRequestID':'checkout-1','CustomerMessage':'Success. Request accepted for processing'
        },'254700000000')
        start=self.client.post('/api/payments/mpesa/initiate/',data=json.dumps({
            'reference':reference,'email':'test@example.com','phone':'0700000000'
        }),content_type='application/json')
        self.assertEqual(start.status_code,201)
        self.assertEqual(start.json()['status'],'pending')
        payment=MpesaPayment.objects.get()
        self.assertEqual(payment.checkout_request_id,'checkout-1')

        wrong=self.client.post('/api/payments/mpesa/callback/wrong-secret/',data='{}',content_type='application/json')
        self.assertEqual(wrong.status_code,404)

        callback={'Body':{'stkCallback':{
            'MerchantRequestID':'merchant-1','CheckoutRequestID':'checkout-1',
            'ResultCode':0,'ResultDesc':'The service request is processed successfully.',
            'CallbackMetadata':{'Item':[
                {'Name':'Amount','Value':1300},
                {'Name':'MpesaReceiptNumber','Value':'TEST123ABC'},
                {'Name':'TransactionDate','Value':20261105095000},
                {'Name':'PhoneNumber','Value':254700000000},
            ]}
        }}}
        cb=self.client.post('/api/payments/mpesa/callback/callback-secret/',data=json.dumps(callback),content_type='application/json')
        self.assertEqual(cb.status_code,200)
        payment.refresh_from_db()
        self.assertEqual(payment.status,'paid')
        self.assertEqual(payment.receipt,'TEST123ABC')

        status=self.client.post('/api/payments/mpesa/status/',data=json.dumps({
            'reference':reference,'email':'test@example.com'
        }),content_type='application/json')
        self.assertEqual(status.status_code,200)
        self.assertEqual(status.json()['status'],'paid')
        self.assertEqual(status.json()['receipt'],'TEST123ABC')

        tracked=self.client.post('/api/orders/track/',data=json.dumps({
            'reference':reference,'email':'test@example.com'
        }),content_type='application/json')
        self.assertEqual(tracked.json()['payment']['status'],'paid')

    @override_settings(MPESA_CALLBACK_TOKEN='callback-secret')
    def test_mpesa_callback_rejects_amount_mismatch_and_handles_cancel(self):
        order=Order.objects.create(name='Test',email='pay@example.com',phone='0700000000',address='Nairobi',payment_method='mpesa',total='650.00')
        payment=MpesaPayment.objects.create(order=order,status='pending',phone='254700000000',amount='650.00',checkout_request_id='mismatch-1')
        mismatch={'Body':{'stkCallback':{
            'CheckoutRequestID':'mismatch-1','ResultCode':0,'ResultDesc':'Success',
            'CallbackMetadata':{'Item':[{'Name':'Amount','Value':1},{'Name':'MpesaReceiptNumber','Value':'BAD123'}]}
        }}}
        self.client.post('/api/payments/mpesa/callback/callback-secret/',data=json.dumps(mismatch),content_type='application/json')
        payment.refresh_from_db()
        self.assertEqual(payment.status,'failed')
        self.assertEqual(payment.receipt,'')

        payment.status='pending';payment.checkout_request_id='cancel-1';payment.save()
        cancelled={'Body':{'stkCallback':{'CheckoutRequestID':'cancel-1','ResultCode':1032,'ResultDesc':'Request cancelled by user'}}}
        self.client.post('/api/payments/mpesa/callback/callback-secret/',data=json.dumps(cancelled),content_type='application/json')
        payment.refresh_from_db()
        self.assertEqual(payment.status,'cancelled')

    def test_inactive_product(self):
        self.product.active=False;self.product.save()
        self.assertEqual(self.post_order(self.order_data()).status_code,400)
    def test_invalid_contact_and_json(self):
        self.assertEqual(self.post_order(self.order_data(email='bad')).status_code,400)
        self.assertEqual(self.client.post('/api/orders/',data='[1]',content_type='application/json').status_code,400)
    def test_enquiry(self):
        data={'dog':self.dog.id,'name':'Customer','email':'test@example.com','message':'I would like to meet Sunny.'}
        self.assertEqual(self.client.post('/api/enquiries/',data=json.dumps(data),content_type='application/json').status_code,201)
        self.assertEqual(Enquiry.objects.count(),1)
        self.dog.available=False;self.dog.save()
        self.assertEqual(self.client.post('/api/enquiries/',data=json.dumps(data),content_type='application/json').status_code,400)
    def test_csrf_and_methods(self):
        client=Client(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/orders/',data=json.dumps(self.order_data()),content_type='application/json').status_code,403)
        response=client.get('/')
        self.assertEqual(client.post('/api/orders/',data=json.dumps(self.order_data()),content_type='application/json',HTTP_X_CSRFTOKEN=response.cookies['csrftoken'].value).status_code,201)
        self.assertEqual(self.client.get('/api/orders/').status_code,405)
        self.assertEqual(self.client.get('/api/orders/track/').status_code,405)
        self.assertEqual(self.client.get('/api/payments/mpesa/initiate/').status_code,405)
        self.assertEqual(self.client.get('/api/payments/mpesa/status/').status_code,405)
    def test_seed_is_repeatable(self):
        call_command('seed_demo',verbosity=0)
        count=(Product.objects.count(),Dog.objects.count())
        call_command('seed_demo',verbosity=0)
        self.assertEqual((Product.objects.count(),Dog.objects.count()),count)
