# Generated for Good Dog Club M-PESA payments
import django.db.models.deletion
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('shop', '0003_order_tracking_statuses')]
    operations = [
        migrations.CreateModel(
            name='MpesaPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('initiated','Initiated'),('pending','Waiting for customer'),('paid','Paid'),('failed','Failed'),('cancelled','Cancelled')], default='initiated', max_length=20)),
                ('phone', models.CharField(max_length=20)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('merchant_request_id', models.CharField(blank=True, max_length=120)),
                ('checkout_request_id', models.CharField(blank=True, db_index=True, max_length=120)),
                ('receipt', models.CharField(blank=True, max_length=80)),
                ('result_code', models.CharField(blank=True, max_length=30)),
                ('result_message', models.CharField(blank=True, max_length=300)),
                ('initiated_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('raw_callback', models.JSONField(blank=True, default=dict)),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='mpesa_payment', to='shop.order')),
            ],
        ),
    ]
