import json
from django.test import TestCase, Client
from django.core.management import call_command
from .models import Product, Dog, Order, Enquiry

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
    def test_seed_is_repeatable(self):
        call_command('seed_demo',verbosity=0)
        count=(Product.objects.count(),Dog.objects.count())
        call_command('seed_demo',verbosity=0)
        self.assertEqual((Product.objects.count(),Dog.objects.count()),count)
