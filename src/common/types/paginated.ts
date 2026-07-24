/**
 * Standard shape for paginated list endpoints:
 * `{ items, total, skip, take }`.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}
