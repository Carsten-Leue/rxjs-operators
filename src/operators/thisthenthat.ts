import { EMPTY, merge, NEVER, Observable } from "rxjs";
import { share, take, takeUntil } from "rxjs/operators";

/**
 * Combines two observables such that the events on the first one are used until the second
 * one starts to produce an event. From then on only the events on the second one
 * will be used and the first one canceled.
 *
 * @param aFirst - the first observable
 * @param aNext - the next one
 * @returns the combined observable
 */
export function thisThenThat<T>(
  aFirst: Observable<T>,
  aNext: Observable<T>
): Observable<T> {
  // share this one
  const next$ = aNext.pipe(share<T>());

  /**
   * Either we get at least one event from the next observable or we
   * never stop, because if we stopped for an empty next sequence, the takeUntil operator
   * would cancel the operation.
   */
  const stop$ = merge(next$, NEVER).pipe(take<T>(1));

  // produce events from the first observable until we get the stop event
  const first$ = aFirst.pipe(takeUntil<T>(stop$));

  // connect
  return merge(first$, next$);
}

/**
 * Combines two observables such that the events on the first one are used until the second
 * one starts to produce an event. From then on only the events on the second one
 * will be used and the first one canceled.
 *
 * @param aObservables - the observables to combine
 * @returns the combined observable
 */
export const thisThenThats = <T>(
  ...aObservables: Array<Observable<T>>
): Observable<T> => aObservables.reduce(thisThenThat, EMPTY);
