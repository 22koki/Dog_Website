from django.contrib import admin
from .models import Product, Dog, Order, OrderItem, Enquiry
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'stock', 'active')
    list_filter = ('category', 'active')
    search_fields = ('name',)
@admin.register(Dog)
class DogAdmin(admin.ModelAdmin):
    list_display = ('name', 'breed', 'price', 'available')
class ItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'name', 'quantity', 'unit_price')
    can_delete = False
    def has_add_permission(self, request, obj=None): return False
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'total', 'delivery_method', 'payment_method', 'status', 'created_at')
    readonly_fields = ('name', 'email', 'phone', 'address', 'delivery_method', 'payment_method', 'notes', 'total', 'created_at')
    inlines = (ItemInline,)
    list_filter = ('status', 'delivery_method', 'payment_method')
    search_fields = ('name', 'email', 'phone')
admin.site.register(Enquiry)
