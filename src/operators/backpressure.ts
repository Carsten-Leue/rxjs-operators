import { defer, isObservable, merge, Observable, OperatorFunction, Subject, UnaryFunction } from 'rxjs';
import { concatMap, endWith, filter, finalize, map, scan } from 'rxjs/operators';

import { arrayPush, isEqual } from '../utils/utils';

const IDLE = Symbol();
declare type IdleType = typeof IDLE;

const DONE = Symbol();
declare type DoneType = typeof DONE;

const NOTHING = Symbol();
declare type NothingType = typeof NOTHING;

declare type BackpressureType<T, R> = NothingType | T[] | Observable<R>;
declare type ScanType<T, R> = [BackpressureType<T, R>, boolean];

const isIdle = (aValue: any): aValue is IdleType => isEqual(aValue, IDLE);
const isDone = (aValue: any): aValue is DoneType => isEqual(aValue, DONE);
const isNothing = (aValue: any): aValue is NothingType =>
  isEqual(aValue, NOTHING);

// array test
function isBuffer<T>(aValue: any): aValue is T[] {
  return Array.isArray(aValue);
}
// observable test
function isBusy<R>(aValue: any): aValue is Observable<R> {
  return isObservable(aValue);
}

/**
 * Implementation of a backpressure operator. The operator will combine source items
 * into chunks and produces a result observable per chunk. It will buffer source
 * items as long as the observable of the last chunk has not finished, yet.
 *
 * @param aDelegate - delegate function to produce the result based on a chunk
 * @returns an operator function that transforms a source sequence into a target sequence
 */
export function chunkedBackpressure<T, R>(
  aDelegate: UnaryFunction<T[], Observable<R>>
): OperatorFunction<T, R> {
  return (src$: Observable<T>) =>
    defer(() => {
      /**
       * Source sequence ending with the done flag
       */
      const obj$ = src$.pipe(endWith(DONE));
      /**
       * Triggers when the generated downstream sequence has terminated
       */
      const idle$ = new Subject<IdleType>();

      // trigger callback
      const opFinal = finalize<R>(() => idle$.next(IDLE));
      /**
       * We merge the original events and the events that tell about downstream readiness
       */
      return merge(obj$, idle$).pipe(
        /**
         * The accumulator is either NOTHING, a (non-empty) buffer or an Observable<R>
         *
         * - if NOTHING the downstreams is idle and we do not have a buffer, yet
         * - if a buffer, downstream is busy and we already have a buffered item
         * - if an observable, downstream is busy but there is no buffered item, yet
         */
        scan(
          (
            [data, bDone]: ScanType<T, R>,
            obj: T | IdleType | DoneType
          ): ScanType<T, R> => {
            /**
             * The idle event indicates that downstream had been busy but is idle, now
             */
            if (isIdle(obj)) {
              /**
               * if there is data in the buffer, process downstream and reset the buffer
               */
              if (isBuffer<T>(data)) {
                /**
                 * Process the buffer
                 */
                return [aDelegate(data), bDone];
              }
              /**
               * If the sequence is done, cancel the stream
               */
              if (bDone) {
                idle$.complete();
              }
              /**
               * Nothing more to do
               */
              return [NOTHING, bDone];
            }
            /**
             * The done event indicates that the source closed
             */
            if (isDone(obj)) {
              /**
               * If we still have a buffer, process it
               */
              if (isBuffer<T>(data)) {
                /**
                 * Process the final buffer
                 */
                return [aDelegate(data), true];
              }
              /**
               * If nothing is waiting downstream, close the stream
               */
              if (isNothing(data)) {
                idle$.complete();
              }
              /**
               * Continue with the empty buffer
               */
              return [NOTHING, true];
            }
            /**
             * Check if we need to buffer
             */
            if (isBuffer<T>(data)) {
              /**
               * Downstream is busy, buffer
               */
              return [arrayPush(obj, data), bDone];
            }
            /**
             * Check if downstream is busy
             */
            if (isNothing(data)) {
              /**
               * Start a new chunk
               */
              return [aDelegate([obj]), bDone];
            }
            // start a new chunk
            return [[obj], bDone];
          },
          [NOTHING, false]
        ),
        // extract the data
        map(([data]) => data),
        // only continue if we have new work
        filter<Observable<R>>(isBusy),
        // append the resulting items and make sure we get notified about the readiness
        concatMap(res$ => res$.pipe(opFinal))
      );
    });
}
