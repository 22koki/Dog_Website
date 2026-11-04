# Generated for Good Dog Club checkout expansion
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('shop', '0001_initial')]
    operations = [
        migrations.AddField(
            model_name='order',
            name='delivery_method',
            field=models.CharField(choices=[('delivery','Delivery'),('pickup','Store pickup')], default='delivery', max_length=20),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_method',
            field=models.CharField(choices=[('mpesa','M-PESA after confirmation'),('cod','Cash on delivery'),('pickup','Pay on pickup')], default='mpesa', max_length=20),
        ),
        migrations.AddField(
            model_name='order',
            name='notes',
            field=models.TextField(blank=True, max_length=600),
        ),
    ]
