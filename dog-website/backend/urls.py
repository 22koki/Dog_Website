from django.contrib import admin
from django.urls import path
from shop import views
urlpatterns = [
    path('', views.home, name='home'),
    path('api/orders/', views.order, name='order'),
    path('api/orders/track/', views.track_order, name='track_order'),
    path('api/enquiries/', views.enquiry, name='enquiry'),
    path('admin/', admin.site.urls),
]
