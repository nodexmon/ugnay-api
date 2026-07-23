export const MIN_REVIEWS_FOR_PUBLIC_RATING = 3;

export function computeWorkerRatingUpdate(
  averageRating: number,
  totalReviews: number,
): { averageRating: number; totalReviews: number; rankingScore: number } {
  const rankingScore =
    totalReviews >= MIN_REVIEWS_FOR_PUBLIC_RATING ? averageRating : 0;
  return { averageRating, totalReviews, rankingScore };
}
