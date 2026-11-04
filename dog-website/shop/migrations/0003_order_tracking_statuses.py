# Generated for Good Dog Club order tracking statuses
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('shop', '0002_order_checkout_options')]
    operations = [
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('requested', 'Awaiting confirmation'),
                    ('confirmed', 'Confirmed'),
                    ('preparing', 'Preparing'),
                    ('out_for_delivery', 'Out for delivery'),
                    ('completed', 'Completed'),
                    ('cancelled', 'Cancelled'),
                ],
                default='requested',
                max_length=30,
            ),
        ),
    ]
