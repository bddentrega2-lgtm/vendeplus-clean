import type { CartItem } from "@/types";

export type CartIssue = {
  index: number;
  kind: "unavailable" | "options" | "price";
  message: string;
};
export type CartReview = { items: CartItem[]; issues: CartIssue[] };

export function optionSignature(item: CartItem) {
  const counts = new Map<string, number>();
  for (const option of item.selectedOptions || []) {
    const key = JSON.stringify([option.groupId, option.valueId, option.groupName, option.valueName, Number(option.priceDeltaUsd)]);
    counts.set(key, (counts.get(key) || 0) + Number(option.quantity || 1));
  }
  return JSON.stringify([...counts].sort(([a], [b]) => a.localeCompare(b)));
}

// Raw rows are loaded once per cart, scoped to its store by the server loader.
export function reviewCartRows(items: CartItem[], products: any[], variants: any[], assignments: any[]): CartReview {
  const productMap = new Map(products.map(product => [String(product.id), product]));
  const variantMap = new Map(variants.map(variant => [String(variant.id), variant]));
  const issues: CartIssue[] = [];
  const next = items.map((item, index) => {
    const product = productMap.get(item.productId);
    if (!product || product.is_available === false) {
      issues.push({ index, kind: "unavailable", message: "Ya no está disponible. Quítalo o elige otro producto." });
      return item;
    }
    const invalidOptions = () => {
      issues.push({ index, kind: "options", message: "Sus presentaciones u opciones cambiaron. Vuelve a elegir este producto en el catálogo." });
      return item;
    };
    const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
    if (item.variantId && (!variant || String(variant.product_id) !== item.productId || variant.is_available === false)) return invalidOptions();
    if (!item.variantId && variants.some(row => String(row.product_id) === item.productId)) return invalidOptions();
    const groups = assignments.filter(row => String(row.product_id) === item.productId)
      .map(row => row.product_option_groups).filter(group => group && group.is_active !== false);
    const selected = item.selectedOptions || [];
    if (selected.some(option => !groups.some(group => String(group.id) === option.groupId))) return invalidOptions();
    const frozen: NonNullable<CartItem["selectedOptions"]> = [];
    for (const group of groups) {
      const choices = selected.filter(option => option.groupId === String(group.id));
      const count = choices.reduce((total, option) => total + Number(option.quantity || 1), 0);
      const min = group.required ? Math.max(1, Number(group.min_select) || 1) : 0;
      const max = Number(group.max_select) || (group.selection_type === "single" ? 1 : 0);
      if (count < min || (max > 0 && count > max) || (group.selection_type === "single" && count > 1)) return invalidOptions();
      for (const choice of choices) {
        const value = (group.product_option_values || []).find((row: any) => String(row.id) === choice.valueId && row.is_active !== false);
        if (!value) return invalidOptions();
        const override = (value.product_option_value_variant_prices || []).find((row: any) => String(row.variant_id) === item.variantId);
        frozen.push({ groupId: String(group.id), groupName: group.name || "Opciones", valueId: String(value.id),
          valueName: value.name || "Opción", priceDeltaUsd: Number(override ? override.price_delta_usd : value.price_delta_usd) || 0,
          quantity: Number(choice.quantity || 1) });
      }
    }
    const grouped = [...frozen.reduce((map, option) => {
      const key = `${option.groupId}:${option.valueId}`;
      const previous = map.get(key);
      if (previous) previous.quantity = Number(previous.quantity || 1) + Number(option.quantity || 1);
      else map.set(key, { ...option });
      return map;
    }, new Map<string, (typeof frozen)[number]>()).values()];
    const discount = Math.max(0, Math.min(95, Number(product.discount_percent) || 0));
    const base = Number(variant ? variant.price_usd : product.price_usd);
    const price = Number((Number((base * (1 - discount / 100)).toFixed(2)) + grouped.reduce((sum, option) => sum + option.priceDeltaUsd * Number(option.quantity || 1), 0)).toFixed(2));
    const updated: CartItem = { ...item, productName: product.name, productImageUrl: product.image_url || item.productImageUrl,
      variantName: variant?.name, unitPriceUsd: price, selectedOptions: grouped };
    if (!Number.isFinite(price) || price < 0) return invalidOptions();
    if (Math.round(item.unitPriceUsd * 100) !== Math.round(price * 100)) {
      issues.push({ index, kind: "price", message: "El precio cambió. Revisa el nuevo monto antes de continuar." });
    } else if (optionSignature(item) !== optionSignature(updated) || (item.variantName || "") !== (updated.variantName || "")) {
      return invalidOptions();
    }
    return updated;
  });
  return { items: next, issues };
}
