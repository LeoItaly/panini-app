# Salling Group Food Waste API – Dataset Structure

This document describes the structure of the dataset returned from the Salling Group Food Waste API. It includes a short explanation of each field.

---

## 🟢 Offer (pricing & availability)

- **offer.currency**: Currency used (e.g. DKK)
- **offer.discount**: Absolute discount amount (difference between original and new price)
- **offer.ean**: Offer-specific EAN (may differ from product EAN)
- **offer.endTime**: Timestamp when the discount ends
- **offer.lastUpdate**: Last update time of the offer/stock
- **offer.newPrice**: Discounted price
- **offer.originalPrice**: Original price before discount
- **offer.percentDiscount**: Discount percentage
- **offer.startTime**: Timestamp when the discount started
- **offer.stock**: Number of items currently available
- **offer.stockUnit**: Unit of stock (e.g. "each", "kg")

---

## 🟡 Product (item information)

- **product.categories.da**: Product category in Danish
- **product.categories.en**: Product category in English
- **product.description**: Product name/description
- **product.ean**: Product barcode (EAN)
- **product.image**: URL to product image

---

## 🔵 Store (location information)

- **store.address.city**: City where the store is located
- **store.address.country**: Country code (e.g. DK)
- **store.address.extra**: Additional address details (often null)
- **store.address.street**: Street name and number
- **store.address.zip**: Postal code
- **store.brand**: Store brand (e.g. Netto, føtex, Bilka)
- **store.coordinates**: Geographic coordinates [longitude, latitude]
- **store.hours**: Opening hours (typically current/next days)
- **store.id**: Unique store identifier
- **store.name**: Store name
- **store.type**: Geometry type (usually "Point")

---

## Notes

- Data is **near real-time** and mainly reflects products close to expiry or recently discounted.
- The dataset may sometimes be empty if no items meet the criteria.
- Fields can occasionally vary, so dynamic schema handling is recommended.
