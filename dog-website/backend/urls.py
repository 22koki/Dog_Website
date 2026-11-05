from django.contrib import admin
from django.urls import path
from shop import views
urlpatterns = [
    path('', views.home, name='home'),
    path('api/orders/', views.order, name='order'),
    path('api/orders/track/', views.track_order, name='track_order'),
    path('api/payments/mpesa/initiate/', views.initiate_mpesa, name='initiate_mpesa'),
    path('api/payments/mpesa/status/', views.mpesa_status, name='mpesa_status'),
    path('api/payments/mpesa/callback/<str:token>/', views.mpesa_callback, name='mpesa_callback'),
    path('api/enquiries/', views.enquiry, name='enquiry'),
    path('admin/', admin.site.urls),
]
