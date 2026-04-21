/**
 * Built-in default UI strings for the 'storefront' namespace in TR + EN.
 * Used (a) as seed values when a new tenant is created, and (b) as a fallback
 * response from GET /v1/public/i18n/bundle so that a storefront with no
 * tenant-level bundle still renders sensible copy.
 *
 * ~60 keys covering nav, cart/checkout labels, buttons, and common error
 * messages. Keys are stable snake_case identifiers; add new keys by extending
 * both dictionaries in lock-step.
 */

export const DEFAULT_STOREFRONT_STRINGS_TR: Record<string, string> = {
  // nav
  'nav.home': 'Ana Sayfa',
  'nav.products': 'Ürünler',
  'nav.categories': 'Kategoriler',
  'nav.brands': 'Markalar',
  'nav.account': 'Hesabım',
  'nav.orders': 'Siparişlerim',
  'nav.cart': 'Sepet',
  'nav.login': 'Giriş Yap',
  'nav.register': 'Üye Ol',
  'nav.logout': 'Çıkış',

  // buttons
  'btn.add_to_cart': 'Sepete Ekle',
  'btn.buy_now': 'Hemen Al',
  'btn.continue': 'Devam Et',
  'btn.cancel': 'İptal',
  'btn.save': 'Kaydet',
  'btn.delete': 'Sil',
  'btn.edit': 'Düzenle',
  'btn.search': 'Ara',
  'btn.submit': 'Gönder',
  'btn.apply': 'Uygula',
  'btn.remove': 'Kaldır',
  'btn.back': 'Geri',

  // product
  'product.price': 'Fiyat',
  'product.in_stock': 'Stokta',
  'product.out_of_stock': 'Stokta Yok',
  'product.quantity': 'Adet',
  'product.description': 'Açıklama',
  'product.reviews': 'Yorumlar',
  'product.related': 'Benzer Ürünler',

  // cart
  'cart.title': 'Sepetim',
  'cart.empty': 'Sepetiniz boş',
  'cart.subtotal': 'Ara Toplam',
  'cart.shipping': 'Kargo',
  'cart.tax': 'KDV',
  'cart.discount': 'İndirim',
  'cart.total': 'Toplam',
  'cart.coupon_code': 'Kupon Kodu',
  'cart.apply_coupon': 'Kuponu Uygula',
  'cart.checkout': 'Ödeme Yap',

  // checkout
  'checkout.title': 'Ödeme',
  'checkout.address': 'Teslimat Adresi',
  'checkout.shipping_method': 'Kargo Seçimi',
  'checkout.payment_method': 'Ödeme Yöntemi',
  'checkout.review': 'Sipariş Özeti',
  'checkout.place_order': 'Siparişi Tamamla',
  'checkout.order_placed': 'Siparişiniz alındı',
  'checkout.cod': 'Kapıda Ödeme',
  'checkout.bank_transfer': 'Havale / EFT',

  // forms
  'form.email': 'E-posta',
  'form.password': 'Şifre',
  'form.first_name': 'Ad',
  'form.last_name': 'Soyad',
  'form.phone': 'Telefon',
  'form.address': 'Adres',
  'form.city': 'Şehir',
  'form.postal_code': 'Posta Kodu',

  // errors
  'error.required': 'Bu alan zorunludur',
  'error.invalid_email': 'Geçerli bir e-posta girin',
  'error.unknown': 'Bir hata oluştu, lütfen tekrar deneyin',
  'error.not_found': 'Aradığınız içerik bulunamadı',
  'error.network': 'Bağlantı hatası',
};

export const DEFAULT_STOREFRONT_STRINGS_EN: Record<string, string> = {
  // nav
  'nav.home': 'Home',
  'nav.products': 'Products',
  'nav.categories': 'Categories',
  'nav.brands': 'Brands',
  'nav.account': 'Account',
  'nav.orders': 'My Orders',
  'nav.cart': 'Cart',
  'nav.login': 'Log in',
  'nav.register': 'Sign up',
  'nav.logout': 'Log out',

  // buttons
  'btn.add_to_cart': 'Add to Cart',
  'btn.buy_now': 'Buy Now',
  'btn.continue': 'Continue',
  'btn.cancel': 'Cancel',
  'btn.save': 'Save',
  'btn.delete': 'Delete',
  'btn.edit': 'Edit',
  'btn.search': 'Search',
  'btn.submit': 'Submit',
  'btn.apply': 'Apply',
  'btn.remove': 'Remove',
  'btn.back': 'Back',

  // product
  'product.price': 'Price',
  'product.in_stock': 'In stock',
  'product.out_of_stock': 'Out of stock',
  'product.quantity': 'Quantity',
  'product.description': 'Description',
  'product.reviews': 'Reviews',
  'product.related': 'Related products',

  // cart
  'cart.title': 'My Cart',
  'cart.empty': 'Your cart is empty',
  'cart.subtotal': 'Subtotal',
  'cart.shipping': 'Shipping',
  'cart.tax': 'Tax',
  'cart.discount': 'Discount',
  'cart.total': 'Total',
  'cart.coupon_code': 'Coupon code',
  'cart.apply_coupon': 'Apply coupon',
  'cart.checkout': 'Checkout',

  // checkout
  'checkout.title': 'Checkout',
  'checkout.address': 'Shipping address',
  'checkout.shipping_method': 'Shipping method',
  'checkout.payment_method': 'Payment method',
  'checkout.review': 'Order summary',
  'checkout.place_order': 'Place order',
  'checkout.order_placed': 'Your order has been placed',
  'checkout.cod': 'Cash on Delivery',
  'checkout.bank_transfer': 'Bank Transfer',

  // forms
  'form.email': 'Email',
  'form.password': 'Password',
  'form.first_name': 'First name',
  'form.last_name': 'Last name',
  'form.phone': 'Phone',
  'form.address': 'Address',
  'form.city': 'City',
  'form.postal_code': 'Postal code',

  // errors
  'error.required': 'This field is required',
  'error.invalid_email': 'Please enter a valid email',
  'error.unknown': 'An unexpected error occurred, please try again',
  'error.not_found': 'Not found',
  'error.network': 'Network error',
};
