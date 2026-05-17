import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart-context';
import { formatDzd } from '../utils';
import { submitCheckout, fetchCommunes, fetchDeliveryFees, fetchWilayas, fetchCenters } from '../api';

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wilayas, setWilayas] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [centers, setCenters] = useState([]);
  const [feeLoading, setFeeLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    wilayaId: '',
    wilayaName: '',
    communeId: '',
    communeName: '',
    centerId: '',
    centerName: '',
    address: '',
    deliveryMethod: 'home',
    notes: ''
  });

  const [deliveryPrice, setDeliveryPrice] = useState(0);
  const total = useMemo(() => subtotal + deliveryPrice, [subtotal, deliveryPrice]);

  function getCookieValue(name) {
    if (typeof document === 'undefined') return '';
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const cookie of cookies) {
      const [key, ...rest] = cookie.split('=');
      if (key === name) {
        return decodeURIComponent(rest.join('='));
      }
    }
    return '';
  }

  function getTikTokTracking() {
    if (typeof window === 'undefined') return { ttclid: '', ttp: '' };
    const params = new URLSearchParams(window.location.search || '');
    const ttclidFromUrl = params.get('ttclid') || '';
    if (ttclidFromUrl) {
      try {
        localStorage.setItem('ttclid', ttclidFromUrl);
      } catch {
        // Ignore storage errors.
      }
    }
    let storedTtclid = '';
    try {
      storedTtclid = localStorage.getItem('ttclid') || '';
    } catch {
      storedTtclid = '';
    }
    const ttp = getCookieValue('_ttp');
    return {
      ttclid: ttclidFromUrl || storedTtclid || '',
      ttp: ttp || '',
    };
  }

  function normalizePhoneDigits(value) {
    return String(value || '')
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/\D/g, '');
  }

  function scrollToField(fieldId) {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      const element = document.getElementById(fieldId);
      if (!element) return;
      const top = window.scrollY + element.getBoundingClientRect().top - 120;
      window.scrollTo({ top, behavior: 'smooth' });
      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }
    });
  }

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.fbq) return;
    if (!items || items.length === 0) return;
    const contentIds = items.map((i) => String(i.productId));
    const numItems = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
    window.fbq('track', 'InitiateCheckout', {
      content_type: 'product',
      content_ids: contentIds,
      currency: 'DZD',
      value: Number(subtotal || 0),
      num_items: numItems,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    fetchWilayas()
      .then((data) => {
        if (!active) return;
        setWilayas(data || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'فشل تحميل الولايات');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!form.wilayaId) return;
    let active = true;
    setCommunes([]);
    setCenters([]);
    set('communeId', '');
    set('communeName', '');
    set('centerId', '');
    set('centerName', '');

    fetchCommunes(form.wilayaId)
      .then((data) => {
        if (!active) return;
        setCommunes(data || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'فشل تحميل البلديات');
      });

    return () => {
      active = false;
    };
  }, [form.wilayaId]);

  useEffect(() => {
    if (!form.wilayaId || form.deliveryMethod !== 'stopdesk') return;
    let active = true;
    setCenters([]);
    set('centerId', '');
    set('centerName', '');

    fetchCenters({ wilayaId: form.wilayaId, communeId: form.communeId })
      .then((data) => {
        if (!active) return;
        setCenters(data || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'فشل تحميل مراكز الاستلام');
      });

    return () => {
      active = false;
    };
  }, [form.wilayaId, form.communeId, form.deliveryMethod]);

  useEffect(() => {
    if (!form.wilayaId) return;
    let active = true;
    setFeeLoading(true);
    fetchDeliveryFees({
      wilayaId: form.wilayaId,
      communeId: form.communeId,
      isStopdesk: form.deliveryMethod === 'stopdesk',
    })
      .then((data) => {
        if (!active) return;
        const basePrice = Number(data?.price) || 0;
        const adjusted = Math.max(0, basePrice - 100);
        setDeliveryPrice(adjusted);
      })
      .catch(() => {
        if (!active) return;
        setDeliveryPrice(0);
      })
      .finally(() => {
        if (!active) return;
        setFeeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.wilayaId, form.deliveryMethod, form.communeId]);

  const submit = async () => {
    if (items.length === 0) return;

    if (!form.name.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة.');
      scrollToField('checkout-name');
      return;
    }

    if (!form.phone.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة.');
      scrollToField('checkout-phone');
      return;
    }

    if (!form.wilayaId) {
      setError('يرجى ملء جميع الحقول المطلوبة.');
      scrollToField('checkout-wilaya');
      return;
    }

    if (!form.communeId) {
      setError('يرجى ملء جميع الحقول المطلوبة.');
      scrollToField('checkout-commune');
      return;
    }

    if (form.deliveryMethod === 'home' && !form.address.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة.');
      scrollToField('checkout-address');
      return;
    }

    const normalizedPhone = normalizePhoneDigits(form.phone);
    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError('رقم هاتفك غير صحيح. يجب أن يكون 10 أرقام.');
      scrollToField('checkout-phone');
      return;
    }

    if (form.deliveryMethod === 'stopdesk' && !form.centerId) {
      setError('يرجى اختيار مكتب الاستلام.');
      scrollToField('checkout-center');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const eventSourceUrl = typeof window !== 'undefined' ? window.location.href : '';
      const tiktokTracking = getTikTokTracking();
      const payload = {
        customer: {
          name: form.name,
          phone: normalizedPhone,
          wilaya: form.wilayaName,
          commune: form.communeName,
          eventSourceUrl,
          ttclid: tiktokTracking.ttclid,
          ttp: tiktokTracking.ttp,
          address: form.deliveryMethod === 'stopdesk'
            ? `${form.centerName} - Bureau Yalidine`
            : form.address,
          centerId: form.centerId,
          deliveryMethod: form.deliveryMethod,
          deliveryPrice,
          notes: form.notes
        },
        items: items.map((item) => ({
          product_id: Number(item.productId),
          variant_id: Number(item.variantId),
          quantity: item.quantity,
          selling_price: item.price
        }))
      };

      const result = await submitCheckout(payload);
      const orderRef = String(result.orderNumber || result.orderId || 'order');
      const purchaseEvent = {
        orderId: orderRef,
        value: Number(total.toFixed(2)),
        contentIds: items.map((item) => String(item.productId)),
        numItems: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      };

      clearCart();
      navigate(`/order-success/${encodeURIComponent(orderRef)}`, {
        state: { purchaseEvent },
      });
    } catch (err) {
      setError(err.message || 'فشل إتمام الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-bleed py-12 pb-32 sm:pb-12">
      <h1 className="section-heading mb-8">إتمام الطلب</h1>

      {error && <p className="text-red-500 text-[13px] mb-4">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="field-block">
            <label>الاسم الكامل</label>
            <input id="checkout-name" className="input-field" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field-block">
            <label>الهاتف</label>
            <input
              id="checkout-phone"
              className="input-field"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              inputMode="numeric"
              maxLength={10}
              placeholder="0XXXXXXXXX"
            />
          </div>
          <div className="field-block">
            <label>طريقة التوصيل</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`rounded-full border px-4 py-2 text-[12px] uppercase tracking-wider transition-all ${
                  form.deliveryMethod === 'home'
                    ? 'border-black bg-black text-white'
                    : 'border-black/20 text-black/70 hover:border-black'
                }`}
                onClick={() => set('deliveryMethod', 'home')}
              >
                للمنزل
              </button>
              <button
                type="button"
                className={`rounded-full border px-4 py-2 text-[12px] uppercase tracking-wider transition-all ${
                  form.deliveryMethod === 'stopdesk'
                    ? 'border-black bg-black text-white'
                    : 'border-black/20 text-black/70 hover:border-black'
                }`}
                onClick={() => set('deliveryMethod', 'stopdesk')}
              >
                مكتب ياليدين
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field-block">
              <label>الولاية</label>
              <select
                id="checkout-wilaya"
                className="input-field"
                value={form.wilayaId}
                onChange={(e) => {
                  const wilayaId = e.target.value;
                  const selected = wilayas.find((w) => String(w.id) === String(wilayaId));
                  set('wilayaId', wilayaId);
                  set('wilayaName', selected?.name || selected?.wilaya_name || '');
                }}
              >
                <option value="">اختر الولاية</option>
                {wilayas.map((w) => (
                  <option key={w.id} value={w.id}>{w.name || w.wilaya_name}</option>
                ))}
              </select>
            </div>
            <div className="field-block">
              <label>البلدية</label>
              <select
                id="checkout-commune"
                className="input-field"
                value={form.communeId}
                onChange={(e) => {
                  const communeId = e.target.value;
                  const selected = communes.find((c) => String(c.id) === String(communeId));
                  set('communeId', communeId);
                  set('communeName', selected?.name || selected?.commune_name || '');
                }}
                disabled={!form.wilayaId}
              >
                <option value="">اختر البلدية</option>
                {communes
                  .filter((c) => form.deliveryMethod !== 'stopdesk' || c.has_stop_desk)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.commune_name}</option>
                  ))}
              </select>
            </div>
          </div>
          {form.deliveryMethod === 'stopdesk' && (
            <div className="field-block">
              <label>مكتب ياليدين</label>
              <select
                id="checkout-center"
                className="input-field"
                value={form.centerId}
                onChange={(e) => {
                  const centerId = e.target.value;
                  const selected = centers.find((c) => String(c.center_id || c.id) === String(centerId));
                  set('centerId', centerId);
                  set('centerName', selected?.name || '');
                }}
                disabled={!form.wilayaId}
              >
                <option value="">اختر مكتب ياليدين</option>
                {centers.map((c) => (
                  <option key={c.center_id || c.id} value={c.center_id || c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field-block">
            <label>العنوان</label>
            <input
              id="checkout-address"
              className="input-field"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              disabled={form.deliveryMethod === 'stopdesk'}
            />
          </div>
          <div className="field-block">
            <label>ملاحظات</label>
            <textarea className="input-field" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/cart" className="btn-primary">
              العودة للسلة
            </Link>
            <Link to="/" className="btn-primary">
              أضف منتجا آخر
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-6 space-y-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-black/45">المجموع الفرعي</span>
            <span className="font-medium">{formatDzd(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-black/45">التوصيل</span>
            <span className="font-medium">
              {feeLoading ? '...' : formatDzd(deliveryPrice)}
            </span>
          </div>
          <div className="h-px bg-black/10" />
          <div className="flex items-center justify-between text-[14px] font-semibold">
            <span>الإجمالي</span>
            <span>{formatDzd(total)}</span>
          </div>
          <button
            className="btn-primary fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] left-4 right-4 z-40 sm:static sm:left-auto sm:right-auto sm:bottom-auto sm:w-full"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'جار الإرسال...' : 'تأكيد الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}
