import { GenericCards, type JsonRecord } from './GenericCards';
import { httpUrl, record, records, SourceLink, StructuredData, text } from './StructuredData';

export function PlaceResults({ data }: { data: JsonRecord }) {
  const places = records(data.placeResults);
  if (!places.length) {
    return <GenericCards items={[]} />;
  }
  return (
    <div className="space-y-4">
      {places.map((place, index) => {
        const location = record(place.location);
        return (
          <article className="space-y-4 border border-ink-200 p-4 text-sm text-ink-800 dark:border-ink-700 dark:text-ink-200" key={index}>
            <h3 className="text-xl font-semibold"><SourceLink url={place.businessUrl}>{text(place.name) ?? 'Place'}</SourceLink></h3>
            <p>{[text(place.category), text(place.closureState)].filter(Boolean).join(' | ')}</p>
            <p>{['addressLine', 'city', 'region', 'postalCode', 'country'].map((key) => text(location[key])).filter(Boolean).join(', ')}</p>
            {text(place.phone) ? <p>{text(place.phone)}</p> : null}
            <div className="flex flex-wrap gap-3">
              {records(place.photos).map((photo, photoIndex) => httpUrl(photo.thumbnailUrl ?? photo.url) ? (
                <figure key={photoIndex}>
                  <img className="h-28 w-40 object-cover" alt={text(photo.caption) ?? ''} src={httpUrl(photo.thumbnailUrl ?? photo.url)} loading="lazy" />
                  <figcaption className="max-w-40 text-xs"><SourceLink url={photo.providerUrl}>{text(photo.providerName) ?? 'Photo source'}</SourceLink></figcaption>
                </figure>
              ) : null)}
            </div>
            <StructuredData value={{ descriptions: place.descriptions, openHours: place.openHours, timeZone: place.timeZone, reviews: place.reviews, amenities: place.amenities, actions: place.actions, passages: place.passages, socialProfiles: place.socialProfiles }} />
          </article>
        );
      })}
    </div>
  );
}
