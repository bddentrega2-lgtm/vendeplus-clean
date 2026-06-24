export type DeliveryType = "delivery" | "pickup";
export type DeliverySource = "none" | "current" | "map";
export type DeliveryProvider = "own_delivery" | "entrega2" | "manual_quote" | "disabled";
export type DeliveryPricingType =
  | "fixed"
  | "fixed_distance"
  | "distance_ranges"
  | "zones"
  | "free_over_amount"
  | "manual";
export type DeliveryPromoDiscountType = "free" | "amount" | "percent";

export type BusinessDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BusinessHoursRange = {
  enabled?: boolean;
  open: string;
  close: string;
};

export type BusinessHours = Partial<Record<BusinessDayKey, BusinessHoursRange[]>>;

export type ManualOpenStatus = "auto" | "open" | "closed";

export type StoreOpenState = {
  isOpen: boolean;
  label: string;
  reason: "manual_open" | "manual_closed" | "schedule_open" | "schedule_closed" | "not_configured";
};

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

export type ProductOptionValue = {
  id: string;
  name: string;
  description?: string;
  priceDeltaUsd: number;
  isActive: boolean;
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  description?: string;
  selectionType: "single" | "multiple";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  isActive: boolean;
  values: ProductOptionValue[];
};

export type SelectedCartOption = {
  groupId: string;
  groupName: string;
  valueId: string;
  valueName: string;
  priceDeltaUsd: number;
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
  optionGroups?: ProductOptionGroup[];
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
  deliverySettings?: StoreDeliverySettings;
  businessHours?: BusinessHours;
  manualOpenStatus?: ManualOpenStatus;
  manualOpenNote?: string;
  openState?: StoreOpenState;
};

export type StoreDeliveryZone = {
  id: string;
  name: string;
  description?: string;
  feeUsd: number;
  isActive: boolean;
  sortOrder: number;
};

export type StoreDeliveryDistanceRate = {
  id: string;
  minKm: number;
  maxKm: number | null;
  feeUsd: number;
  isActive: boolean;
  sortOrder: number;
};

export type StoreDeliverySettings = {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryProvider: DeliveryProvider;
  pricingType: DeliveryPricingType;
  fixedFeeUsd: number;
  freeDeliveryMinUsd: number | null;
  deliveryPromoEnabled: boolean;
  deliveryPromoMinSubtotalUsd: number | null;
  deliveryPromoDiscountType: DeliveryPromoDiscountType;
  deliveryPromoDiscountValue: number;
  maxDistanceKm: number | null;
  distanceFactor: number | null;
  manualQuoteMessage: string;
  zones: StoreDeliveryZone[];
  distanceRates: StoreDeliveryDistanceRate[];
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
  selectedOptions?: SelectedCartOption[];
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
  originalFeeUsd?: number;
  discountUsd?: number;
  label: string;
  source: "route" | "fallback" | "manual" | "pickup" | "pending";
  available?: boolean;
  provider?: DeliveryProvider;
  pricingType?: DeliveryPricingType;
  zoneId?: string | null;
  zoneName?: string | null;
  message?: string;
};

export type CheckoutFormData = {
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  paymentMethod: string;
  paymentReference: string;
  deliveryReference: string;
  deliveryZoneId: string;
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




