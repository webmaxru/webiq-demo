import type { JsonRecord } from './GenericCards';
import { httpUrl, record, records, SourceLink, StructuredData, text } from './StructuredData';

export function commercePrice(value: unknown): string | undefined {
  const price = record(value);
  const amount = price.offeredPrice ?? price.listPrice;
  const currency = text(price.currency);
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !currency || !/^[A-Z]{3}$/.test(currency)) {
    return undefined;
  }
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** digits);
}

function OfferCards({ offers }: { offers: unknown }) {
  const eligible = records(offers).filter((offer) => httpUrl(offer.clickUrl));
  if (!eligible.length) {
    return <p className="text-sm text-ink-500 dark:text-ink-400">No displayable offers with a usable clickUrl.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {eligible.map((offer, index) => (
        <article className="space-y-3 border border-ink-200 p-4 text-sm dark:border-ink-700" key={index}>
          {httpUrl(records(offer.images)[0]?.url) ? <img className="h-36 w-full object-contain" src={httpUrl(records(offer.images)[0]?.url)} alt="" loading="lazy" /> : null}
          <h4 className="font-semibold"><SourceLink url={offer.clickUrl}>{text(offer.name) ?? 'View offer'}</SourceLink></h4>
          <p>{text(record(offer.seller).name)}</p>
          <p className="text-lg font-bold">{commercePrice(offer.price) ?? 'Price unavailable'}</p>
          <p>{text(offer.shippingInfo)}</p>
          <p>{text(offer.condition)}</p>
          <p className="break-all text-xs text-ink-500">{text(offer.displayUrl)}</p>
          {text(offer.id) ? <p className="break-all font-mono text-xs">Offer ID: {text(offer.id)}</p> : null}
          <details>
            <summary className="cursor-pointer font-semibold">Description &amp; specifications</summary>
            <StructuredData value={{ description: offer.description, specifications: offer.specifications, installmentInfo: offer.installmentInfo }} />
          </details>
        </article>
      ))}
    </div>
  );
}

export function CommerceResults({ data }: { data: JsonRecord }) {
  if (Array.isArray(data.offers)) {
    return <OfferCards offers={data.offers} />;
  }
  const products = records(data.products);
  return (
    <div className="space-y-4 text-ink-900 dark:text-ink-100">
      {!products.length ? <p className="text-sm text-ink-500">No products.</p> : null}
      {products.map((product, index) => (
        <article className="space-y-3 border border-ink-200 p-4 dark:border-ink-700" key={index}>
          <h3 className="font-semibold">{text(product.name) ?? `Product ${index + 1}`}</h3>
          {text(product.id) ? <p className="break-all font-mono text-xs">Product ID: {text(product.id)}</p> : null}
          {text(product.skuId) ? <p className="break-all font-mono text-xs">SKU ID: {text(product.skuId)}</p> : null}
          {product.description || product.rating ? <StructuredData value={{ description: product.description, rating: product.rating }} /> : null}
          {'offers' in product || !('name' in product) ? <OfferCards offers={product.offers} /> : null}
        </article>
      ))}
    </div>
  );
}
