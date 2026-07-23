import {
  computeWorkerRatingUpdate,
  MIN_REVIEWS_FOR_PUBLIC_RATING,
} from './rating.util';

describe('computeWorkerRatingUpdate', () => {
  it('sets rankingScore to averageRating when review count meets the threshold', () => {
    const result = computeWorkerRatingUpdate(
      4.5,
      MIN_REVIEWS_FOR_PUBLIC_RATING,
    );

    expect(result).toEqual({
      averageRating: 4.5,
      totalReviews: MIN_REVIEWS_FOR_PUBLIC_RATING,
      rankingScore: 4.5,
    });
  });

  it('sets rankingScore to 0 when review count is below the threshold', () => {
    const result = computeWorkerRatingUpdate(
      4.5,
      MIN_REVIEWS_FOR_PUBLIC_RATING - 1,
    );

    expect(result).toEqual({
      averageRating: 4.5,
      totalReviews: MIN_REVIEWS_FOR_PUBLIC_RATING - 1,
      rankingScore: 0,
    });
  });

  it('sets both averageRating and rankingScore to 0 when there are no reviews', () => {
    const result = computeWorkerRatingUpdate(0, 0);

    expect(result).toEqual({
      averageRating: 0,
      totalReviews: 0,
      rankingScore: 0,
    });
  });

  it('handles exactly the minimum threshold review count', () => {
    const result = computeWorkerRatingUpdate(
      3.0,
      MIN_REVIEWS_FOR_PUBLIC_RATING,
    );

    expect(result.rankingScore).toBe(3.0);
  });
});
