import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchProductById, fetchProducts } from '../api';
import { formatDzd, extractIdFromSlug, resolveImageUrl, getPromotionPrice, getEffectivePrice } from '../utils';
import QuantityPicker from '../components/QuantityPicker';
import { useCart } from '../cart-context';
import SmartImage from '../components/SmartImage';
import ProductCard from '../components/ProductCard';
import TrustStrip from '../components/TrustStrip';
import SocialProof from '../components/SocialProof';
import CustomerReviews from '../components/CustomerReviews';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

const SIZE_PRIORITY = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [colorDragOffsetX, setColorDragOffsetX] = useState(0);
  const [isColorDragging, setIsColorDragging] = useState(false);

  useEffect(() => {
    const id = extractIdFromSlug(slug || '');
    if (!id) {
      setError('المنتج غير موجود');
      setLoading(false);
      return;
    }

    let active = true;
    fetchProductById(id)
      .then((data) => {
        if (!active) return;
        setProduct(data);
        const firstAvailable = data?.variants?.find((v) => v.quantity > 0);
        setSelectedColor(String(firstAvailable?.color || '').trim());
        setSelectedSize(String(firstAvailable?.size || '').trim());
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'فشل تحميل المنتج');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;

    fetchProducts()
      .then((data) => {
        if (!active) return;
        setCatalog(data || []);
      })
      .catch(() => {
        if (!active) return;
        setCatalog([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const availableVariants = useMemo(() => product?.variants || [], [product]);
  const sizes = useMemo(() => {
    const uniqueSizes = Array.from(
      new Set(availableVariants.map((v) => String(v.size || '').trim()))
    ).filter(Boolean);

    return uniqueSizes.sort((a, b) => {
      const left = String(a || '').trim().toUpperCase();
      const right = String(b || '').trim().toUpperCase();
      const leftIndex = SIZE_PRIORITY.indexOf(left);
      const rightIndex = SIZE_PRIORITY.indexOf(right);

      // Keep clothing sizes in the exact requested order, then sort remaining values naturally.
      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }

      return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [availableVariants]);

  const colors = useMemo(() => {
    const byNormalized = new Map();
    for (const v of availableVariants) {
      const label = String(v.color || '').trim();
      const key = normalizeText(label);
      if (!key || byNormalized.has(key)) continue;
      byNormalized.set(key, label);
    }
    return Array.from(byNormalized.entries()).map(([value, label]) => ({ value, label }));
  }, [availableVariants]);

  const selectedVariant = useMemo(
    () =>
      availableVariants.find(
        (v) =>
          normalizeText(v.size) === normalizeText(selectedSize)
          && normalizeText(v.color) === normalizeText(selectedColor)
      ),
    [availableVariants, selectedColor, selectedSize]
  );

  const selectedColorImage = useMemo(() => {
    return availableVariants.find(
      (v) => normalizeText(v.color) === normalizeText(selectedColor) && v.image
    )?.image || '';
  }, [availableVariants, selectedColor]);

  const currentColorImages = useMemo(() => {
    const colorKey = normalizeText(selectedColor);
    const extraImages = product?.color_images?.[colorKey] || [];
    const variantImage = selectedColorImage;
    if (extraImages.length > 0) return extraImages;
    if (variantImage) return [variantImage];
    if (product?.image) return [product.image];
    return [];
  }, [product, selectedColor, selectedColorImage]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedColor]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.fbq || !product) return;
    window.fbq('track', 'ViewContent', {
      content_type: 'product',
      content_ids: [String(product.id)],
      content_name: product.model_name,
      currency: 'DZD',
      value: Number(getEffectivePrice(product) || 0),
    });
  }, [product]);

  const displayImage = currentColorImages[activeImageIndex] || selectedColorImage || product?.image;

  const swipableColors = useMemo(() => {
    return colors.filter((color) =>
      availableVariants.some((v) => normalizeText(v.color) === color.value && v.quantity > 0)
    );
  }, [colors, availableVariants]);

  function applyColorSelection(color) {
    if (!color) return;

    setSelectedColor(color.label);
    const hasSizeForColor = availableVariants.some(
      (v) =>
        normalizeText(v.color) === color.value
        && normalizeText(v.size) === normalizeText(selectedSize)
        && v.quantity > 0
    );

    if (!hasSizeForColor) {
      const firstMatch = availableVariants.find(
        (v) => normalizeText(v.color) === color.value && v.quantity > 0
      ) || availableVariants.find((v) => normalizeText(v.color) === color.value);

      if (firstMatch?.size) {
        setSelectedSize(String(firstMatch.size).trim());
      }
    }
  }

  function goToRelativeColor(step) {
    if (colors.length < 2) return;
    const currentColorIndex = colors.findIndex((c) => normalizeText(selectedColor) === c.value);
    const nextColorIndex = (currentColorIndex + step + colors.length) % colors.length;
    const nextColor = colors[nextColorIndex];
    if (nextColor) {
      applyColorSelection(nextColor);
    }
  }

  // Unified navigation: cycles through current color images, then jumps to next color
  function goToRelativeImage(step) {
    const imgCount = currentColorImages.length;
    if (imgCount > 1) {
      const nextIdx = activeImageIndex + step;
      if (nextIdx >= 0 && nextIdx < imgCount) {
        setActiveImageIndex(nextIdx);
        return;
      }
      // At boundary: switch color if available
      if (colors.length > 1) {
        goToRelativeColor(step);
        return;
      }
      // Wrap within current color
      setActiveImageIndex((nextIdx + imgCount) % imgCount);
      return;
    }
    // Single image: navigate colors
    if (colors.length > 1) {
      goToRelativeColor(step);
    }
  }

  function handleImageTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
    setIsColorDragging(false);
    setDragOffsetX(0);
    setColorDragOffsetX(0);
  }

  function handleImageTouchMove(event) {
    const touch = event.touches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
    }

    // Check if at boundaries and can switch colors
    const atFirstImage = activeImageIndex === 0;
    const atLastImage = activeImageIndex === currentColorImages.length - 1 || currentColorImages.length <= 1;
    const tryingGoPrev = deltaX > 0;
    const tryingGoNext = deltaX < 0;

    // If at boundary and multiple colors, show color transition preview
    if (colors.length > 1 && ((atFirstImage && tryingGoPrev) || (atLastImage && tryingGoNext))) {
      setIsColorDragging(true);
      const limitedOffset = Math.max(-120, Math.min(120, deltaX));
      setColorDragOffsetX(limitedOffset);
      setDragOffsetX(0);
    } else {
      setIsColorDragging(false);
      const limitedOffset = Math.max(-90, Math.min(90, deltaX));
      setDragOffsetX(limitedOffset);
      setColorDragOffsetX(0);
    }
  }

  function handleImageTouchEnd(event) {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      setIsDragging(false);
      setIsColorDragging(false);
      setDragOffsetX(0);
      setColorDragOffsetX(0);
      return;
    }

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    setIsDragging(false);

    // Handle color swipe at boundaries
    if (isColorDragging && colors.length > 1) {
      const atFirstImage = activeImageIndex === 0;
      const atLastImage = activeImageIndex === currentColorImages.length - 1 || currentColorImages.length <= 1;
      
      if (Math.abs(deltaX) > 60) {
        if (deltaX < 0 && atLastImage) {
          // Swipe left at last image → next color
          setColorDragOffsetX(0);
          setIsColorDragging(false);
          goToRelativeColor(1);
          return;
        } else if (deltaX > 0 && atFirstImage) {
          // Swipe right at first image → previous color
          setColorDragOffsetX(0);
          setIsColorDragging(false);
          goToRelativeColor(-1);
          return;
        }
      }
    }

    setColorDragOffsetX(0);
    setIsColorDragging(false);
    setDragOffsetX(0);

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      goToRelativeImage(1);
    } else {
      goToRelativeImage(-1);
    }
  }

  useEffect(() => {
    if (!availableVariants.length && !product?.image) return;

    const uniqueImagePaths = new Set();

    for (const variant of availableVariants) {
      if (variant?.image) {
        uniqueImagePaths.add(variant.image);
      }
    }

    if (product?.image) {
      uniqueImagePaths.add(product.image);
    }

    const colorImagesMap = product?.color_images || {};
    for (const urls of Object.values(colorImagesMap)) {
      if (Array.isArray(urls)) {
        for (const url of urls) {
          if (url) uniqueImagePaths.add(url);
        }
      }
    }

    const preloaders = [];
    for (const imagePath of uniqueImagePaths) {
      const img = new Image();
      img.decoding = 'async';
      img.src = resolveImageUrl(imagePath);
      preloaders.push(img);
    }
  }, [availableVariants, product?.image, product?.color_images]);

  const maxQuantity = selectedVariant?.quantity || 0;
  const promotionPrice = getPromotionPrice(product);
  const effectivePrice = getEffectivePrice(product);
  const suggestedProducts = useMemo(() => {
    if (!catalog.length) return [];

    const currentId = String(product?.id || '');
    const pool = catalog.filter((item) => String(item?.id || '') !== currentId);
    const pickedIds = new Set();

    const forcedId = '22';
    const forcedMatch = pool.find((item) => String(item?.id || '') === forcedId);

    const picks = [];
    if (forcedMatch) {
      picks.push(forcedMatch);
      pickedIds.add(forcedMatch.id);
    }


    const groups = [
      {
        key: 'tshirt',
        match: (item) => {
          const category = normalizeText(item?.category);
          const name = normalizeText(item?.model_name);
          return category.includes('t-shirt') || category.includes('tshirt') || name.includes('t-shirt') || name.includes('tshirt');
        },
      },
      {
        key: 'pants',
        match: (item) => {
          const category = normalizeText(item?.category);
          const name = normalizeText(item?.model_name);
          return category.includes('pants') || category.includes('pantalon') || name.includes('pants') || name.includes('pantalon');
        },
      },
      {
        key: 'shoes',
        match: (item) => {
          const category = normalizeText(item?.category);
          const name = normalizeText(item?.model_name);
          return category.includes('shoes') || category.includes('shoe') || category.includes('chaussure') || name.includes('shoes') || name.includes('shoe') || name.includes('chaussure');
        },
      },
    ];

    function pickRandom(list) {
      if (!list.length) return null;
      const index = Math.floor(Math.random() * list.length);
      return list[index];
    }

    for (const group of groups) {
      const matching = pool.filter((item) => !pickedIds.has(item.id) && group.match(item));
      const inStock = matching.filter((item) => Number(item.total_stock || 0) > 0);
      const selected = pickRandom(inStock) || pickRandom(matching);
      if (!selected) continue;
      pickedIds.add(selected.id);
      picks.push(selected);
    }

    return picks;
  }, [catalog, product?.id]);

  const onAdd = () => {
    if (!product || !selectedVariant || maxQuantity <= 0) return;
    addItem({
      productId: String(product.id),
      variantId: String(selectedVariant.id),
      title: product.model_name,
      image: resolveImageUrl(displayImage || product.image),
      price: effectivePrice,
      size: selectedVariant.size,
      color: selectedVariant.color,
      quantity,
    });
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'AddToCart', {
        content_type: 'product',
        content_ids: [String(product.id)],
        content_name: product.model_name,
        currency: 'DZD',
        value: Number(effectivePrice || 0) * Number(quantity || 1),
        num_items: Number(quantity || 1),
      });
    }
    navigate('/cart');
  };

  if (loading) {
    return <div className="container-bleed py-16 text-[13px] text-black/50">جار التحميل...</div>;
  }

  if (error || !product) {
    return (
      <div className="container-bleed py-16">
        <p className="text-red-500 text-[13px]">{error || 'المنتج غير موجود'}</p>
        <Link to="/" className="btn-primary mt-6 inline-flex px-6">العودة للمتجر</Link>
      </div>
    );
  }

  return (
    <div className="container-bleed py-4 pb-32 sm:py-8 sm:pb-12">
      <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
        <div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-115 overflow-hidden bg-[#f5f1ea] max-h-[58vh] sm:aspect-3/4 sm:max-h-none">
            <div
              className={`h-full w-full relative ${isDragging && !isColorDragging ? '' : 'transition-transform duration-300 ease-out'}`}
              style={{ transform: `translateX(${isColorDragging ? colorDragOffsetX : dragOffsetX}px)` }}
            >
              {/* Color peek preview indicators */}
              {isColorDragging && colorDragOffsetX !== 0 && colors.length > 1 && (
                <>
                  {colorDragOffsetX > 30 && colors.findIndex((c) => normalizeText(selectedColor) === c.value) > 0 && (
                    <div className="absolute left-0 top-0 h-full w-20 flex items-center justify-center bg-gradient-to-r from-black/10 to-transparent z-20 pointer-events-none">
                      <ChevronLeft size={32} className="text-white/80 drop-shadow-lg" />
                    </div>
                  )}
                  {colorDragOffsetX < -30 && colors.findIndex((c) => normalizeText(selectedColor) === c.value) < colors.length - 1 && (
                    <div className="absolute right-0 top-0 h-full w-20 flex items-center justify-center bg-gradient-to-l from-black/10 to-transparent z-20 pointer-events-none">
                      <ChevronRight size={32} className="text-white/80 drop-shadow-lg" />
                    </div>
                  )}
                </>
              )}
              <SmartImage
                key={displayImage}
                src={resolveImageUrl(displayImage)}
                alt={product.model_name}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-contain sm:object-cover"
                onTouchStart={handleImageTouchStart}
                onTouchMove={handleImageTouchMove}
                onTouchEnd={handleImageTouchEnd}
              />
            </div>

            {/* Unified navigation arrows - show when there's more than 1 thing to navigate */}
            {(currentColorImages.length > 1 || colors.length > 1) && (
              <>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => goToRelativeImage(-1)}
                  className="pointer-events-auto absolute left-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black/70 shadow-md backdrop-blur-md transition hover:bg-white"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => goToRelativeImage(1)}
                  className="pointer-events-auto absolute right-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black/70 shadow-md backdrop-blur-md transition hover:bg-white"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* Image counter badge */}
            <div className="absolute top-3 right-3 z-10 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] text-white backdrop-blur-sm">
              {activeImageIndex + 1} / {currentColorImages.length || 1}
            </div>

            {/* Single set of dots: image position within current color */}
            {currentColorImages.length > 1 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center">
                <div className="flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-sm">
                  {currentColorImages.map((_, idx) => (
                    <span
                      key={idx}
                      className={`block rounded-full transition-all ${idx === activeImageIndex ? 'h-1.5 w-5 bg-white' : 'h-1.5 w-1.5 bg-white/50'}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {currentColorImages.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 px-1 mx-auto max-w-115">
              {currentColorImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === activeImageIndex
                      ? 'border-black ring-1 ring-black/20'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={resolveImageUrl(img)}
                    alt={`${product.model_name} ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display text-ink leading-tight">{product.model_name}</h1>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-[18px] sm:text-[16px] font-semibold text-ink">{formatDzd(effectivePrice)}</p>
              {promotionPrice ? <p className="text-[13px] text-black/35 line-through">{formatDzd(product.selling_price)}</p> : null}
              {promotionPrice && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                  -{Math.round(((product.selling_price - promotionPrice) / product.selling_price) * 100)}%
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">اللون</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {colors.map((color) => {
                  const isAvailable = availableVariants.some(
                    (v) => normalizeText(v.color) === color.value && v.quantity > 0
                  );
                  return (
                    <button
                      key={color.value}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => applyColorSelection(color)}
                      className={`rounded-full border px-4 py-2 text-[12px] uppercase tracking-wider transition-all ${
                        normalizeText(selectedColor) === color.value
                          ? 'border-black bg-black text-white'
                          : isAvailable
                          ? 'border-black/20 text-black/70 hover:border-black'
                          : 'border-black/10 text-black/30'
                      }`}
                    >
                      {color.label || 'افتراضي'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">المقاس</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const isAvailable = availableVariants.some(
                    (v) =>
                      normalizeText(v.size) === normalizeText(size)
                      && normalizeText(v.color) === normalizeText(selectedColor)
                      && v.quantity > 0
                  );
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSelectedSize(size)}
                      className={`rounded-full border px-4 py-2 text-[12px] uppercase tracking-wider transition-all ${
                        selectedSize === size
                          ? 'border-black bg-black text-white'
                          : isAvailable
                          ? 'border-black/20 text-black/70 hover:border-black'
                          : 'border-black/10 text-black/30'
                      }`}
                    >
                      {size || 'مقاس واحد'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">الكمية</p>
                {maxQuantity > 0 && maxQuantity < 3 && (
                  <p className="text-[11px] text-red-500 font-medium">كمية قليلة</p>
                )}
              </div>
              <QuantityPicker value={quantity} onChange={setQuantity} max={maxQuantity || 1} />
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="btn-cta-main btn-cta-fixed"
              disabled={!selectedVariant || maxQuantity <= 0}
              onClick={onAdd}
            >
              <span className="sm:hidden">اطلب الآن · {formatDzd(effectivePrice)}</span>
              <span className="hidden sm:inline">اطلب الآن - الدفع عند الاستلام</span>
            </button>
            <p className="hidden sm:block text-[12px] font-semibold text-black/60">🔥 Stock limité aujourd'hui</p>
          </div>

          <TrustStrip />

          <SocialProof rating={4.8} orders={120} />

          {product.description && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">الوصف</p>
              <p className="mt-2 text-[13px] leading-relaxed text-black/55" style={{ whiteSpace: 'pre-line' }}>
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {suggestedProducts.length > 0 && (
        <section className="mt-16 border-t border-black/10 pt-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="section-heading">قد يعجبك أيضاً</h2>
            <Link to="/" className="text-[11px] uppercase tracking-[0.3em] text-black/40">
              المزيد
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
            {suggestedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      <CustomerReviews />
    </div>
  );
}
