export type DeliveryType = "delivery" | "pickup";
export type DeliverySource = "none" | "current" | "map";

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  priceDeltaUsd: number;
  isAvailable: boolean;
};

export type Product = {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  priceUsd: number;
  imageUrl: string;
  imageAlt: string;
  imageEmoji?: string;
  isAvailable: boolean;
  isFeatured?: boolean;
  tags?: string[];
  variants?: ProductVariant[];
};

export type Store = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  whatsappPhone: string;
  address: string;
  latitude: number;
  longitude: number;
  openingHours: string;
  deliveryEstimate: string;
  pickupEstimate: string;
  badge: string;
  heroImageUrl: string;
  primaryColor: string;
  accentColor: string;
  categories: Category[];
  products: Product[];
  paymentMethods: string[];
  usdToBs?: number;
  paymentDetails?: StorePaymentDetails;
  logoUrl?: string;
  coverImageUrl?: string;
  buttonTextColor?: string;
};

export type StorePaymentDetails = {
  pagoMovil?: {
    bank?: string;
    phone?: string;
    idNumber?: string;
    holder?: string;
  };
  transferencia?: {
    bank?: string;
    accountNumber?: string;
    idNumber?: string;
    holder?: string;
  };
  zelle?: {
    contact?: string;
    holder?: string;
  };
  binance?: {
    contact?: string;
    holder?: string;
  };
  efectivo?: {
    note?: string;
  };
};

export type CartItem = {
  productId: string;
  productName: string;
  productSlug: string;
  productImageUrl: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPriceUsd: number;
  notes?: string;
};

export type DeliveryLocation = {
  latitude: number;
  longitude: number;
  label: string;
  source: DeliverySource;
  accuracyMeters?: number;
};

export type DeliveryQuote = {
  distanceKm: number | null;
  feeUsd: number;
  label: string;
  source: "route" | "fallback" | "manual" | "pickup" | "pending";
};

export type CheckoutFormData = {
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  paymentMethod: string;
  paymentReference: string;
  deliveryReference: string;
  orderDetails: string;
  notes: string;
};

export type OrderTotals = {
  subtotalUsd: number;
  deliveryUsd: number;
  totalUsd: number;
  totalBs: number;
};

export type SavedOrder = {
  id: string;
  storeSlug: string;
  storeName: string;
  createdAt: string;
  items: CartItem[];
  form: CheckoutFormData;
  location: DeliveryLocation | null;
  quote: DeliveryQuote;
  totals: OrderTotals;
  mapsUrl: string | null;
  routeUrl: string | null;
  whatsappMessage: string;
  whatsappUrl: string;
};




