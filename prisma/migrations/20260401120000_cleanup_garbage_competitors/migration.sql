-- Remove auto-detected competitor records that are clearly not business names.
-- These were created before the noise filtering was added to competitor-detector.ts.
DELETE FROM "CompetitorCitation"
WHERE "competitorId" IN (
  SELECT "id" FROM "Competitor"
  WHERE "isAutoDetected" = true
  AND LOWER("competitorName") IN (
    'rating', 'ratings', 'description', 'address', 'phone', 'hours',
    'website', 'reviews', 'review', 'location', 'directions', 'menu',
    'price', 'prices', 'pricing', 'category', 'categories', 'summary',
    'overview', 'about', 'contact', 'features', 'services', 'products',
    'disclaimer', 'too many requests', 'not found', 'internal server error',
    'bad gateway', 'service unavailable', 'access denied', 'forbidden',
    'unauthorized', 'error', 'unknown', 'none', 'null', 'undefined',
    'based on', 'according to', 'note that', 'keep in mind',
    'important note', 'please note', 'in conclusion', 'top picks',
    'best options', 'here are some', 'google maps', 'yelp reviews',
    'trip advisor'
  )
);

DELETE FROM "Competitor"
WHERE "isAutoDetected" = true
AND LOWER("competitorName") IN (
  'rating', 'ratings', 'description', 'address', 'phone', 'hours',
  'website', 'reviews', 'review', 'location', 'directions', 'menu',
  'price', 'prices', 'pricing', 'category', 'categories', 'summary',
  'overview', 'about', 'contact', 'features', 'services', 'products',
  'disclaimer', 'too many requests', 'not found', 'internal server error',
  'bad gateway', 'service unavailable', 'access denied', 'forbidden',
  'unauthorized', 'error', 'unknown', 'none', 'null', 'undefined',
  'based on', 'according to', 'note that', 'keep in mind',
  'important note', 'please note', 'in conclusion', 'top picks',
  'best options', 'here are some', 'google maps', 'yelp reviews',
  'trip advisor'
);
