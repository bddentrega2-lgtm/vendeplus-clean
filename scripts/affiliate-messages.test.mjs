import { test } from 'node:test';
import assert from 'node:assert/strict';
import { affiliateWelcomeMessage, registrationPriceMessage } from '../src/lib/affiliates.ts';

for (const [discountPercent, dueUsd] of [[0, 20], [50, 10], [75, 5], [100, 0]]) {
  test(`Registration WhatsApp terms: ${discountPercent}%`, () => {
    const text = registrationPriceMessage({ baseUsd: 20, discountPercent, dueUsd, code: discountPercent ? 'ALIADO50' : '' });
    assert.ok(text.includes(`Total a pagar: US$${dueUsd.toFixed(2)}`));
    assert.ok(text.includes(discountPercent ? `Descuento: ${discountPercent}%` : 'sin descuento'));
    assert.ok(text.includes(dueUsd ? 'Pago pendiente' : 'Sin pago inicial'));
    assert.ok(!text.includes('Reportar pago:'));
  });
}
for (const partner_type of ['seller', 'creator', 'delivery']) {
  test(`Welcome and access for ${partner_type}`, () => {
    const text = affiliateWelcomeMessage('https://www.somos-ve.com/admin/aliados', { name: 'Aliado Demo', code: 'DEMO', partner_type, beneficiary_email: partner_type === 'delivery' ? null : 'demo@example.invalid' });
    assert.ok(text.includes('https://www.somos-ve.com/registro?ref=DEMO'));
    assert.ok(text.includes('codigo de referido: DEMO'));
    if (partner_type === 'delivery') {
      assert.ok(text.includes('/transporte/panel/referidos'));
      assert.ok(!text.includes('Google: null'));
    } else {
      assert.ok(text.includes('Google: demo@example.invalid'));
      assert.ok(text.includes('https://www.somos-ve.com/aliados'));
    }
  });
}
