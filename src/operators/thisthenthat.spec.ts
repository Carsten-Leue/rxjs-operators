import { marbles } from "rxjs-marbles";
import { MonoTypeOperatorFunction, defer } from "rxjs";
import { finalize, take } from "rxjs/operators";
import { thisThenThats } from "./thisthenthat";

/**
 * Returns an operator that invokes a callback with the subscription count
 *
 * @param aCallback - the callback
 * @returns the operator
 */
function rxWithSubscriptionCount<T>(
  aCallback: (value: number) => void
): MonoTypeOperatorFunction<T> {
  // subscription count
  let subCount = 0;
  // returns the actual operator
  return aSrc$ =>
    defer(() => {
      aCallback(++subCount);
      return aSrc$.pipe(finalize(() => aCallback(--subCount)));
    });
}

describe("thisThenThat", () => {
  it(
    "should unsubscribe the this-then-that observables",
    marbles(m => {
      let src1 = 0;
      let src2 = 0;

      const src1$ = m
        .cold("aaa")
        .pipe(rxWithSubscriptionCount(c => (src1 = c)));
      const src2$ = m
        .cold("--bbb")
        .pipe(rxWithSubscriptionCount(c => (src2 = c)));

      const combined$ = thisThenThats(src1$, src2$).pipe(take(5));
      const expected$ = m.cold("aabb(b|)");

      m.expect(combined$).toBeObservable(expected$);

      expect(src1).toBe(0);
      expect(src2).toBe(0);
    })
  );

  it(
    "should ensure that thisThenThat works our of order",
    marbles(m => {
      // prepare the sources
      const src1 = m.cold("--bbbbbbbb|");
      const src2 = m.cold("aa-aa-aaa|");
      const src3 = m.cold("--------ccc|");

      const chain = thisThenThats(src1, src2, src3);

      const result = m.cold("aa-aa-aaccc|");

      m.expect(chain).toBeObservable(result);
    })
  );

  it(
    "should ensure that thisThenThat is working",
    marbles(m => {
      // prepare the sources
      const src1 = m.cold("aa-aa-aaa|");
      const src2 = m.cold("--bbbbbbbb|");
      const src3 = m.cold("--------ccc|");

      const chain = thisThenThats(src1, src2, src3);

      const result = m.cold("aabbbbbbccc|");

      m.expect(chain).toBeObservable(result);
    })
  );

  it(
    "should ensure that thisThenThat is working with an empty sequence",
    marbles(m => {
      // prepare the sources
      const src1 = m.cold("|");
      const src2 = m.cold("--bbbbbbbb|");
      const src3 = m.cold("--------ccc|");

      const chain = thisThenThats(src1, src2, src3);

      const result = m.cold("--bbbbbbccc|");

      m.expect(chain).toBeObservable(result);
    })
  );

  it(
    "should ensure that thisThenThat is working with a empty sequences",
    marbles(m => {
      // prepare the sources
      const src1 = m.cold("|");
      const src2 = m.cold("|");
      const src3 = m.cold("--------ccc|");

      const chain = thisThenThats(src1, src2, src3);

      const result = m.cold("--------ccc|");

      m.expect(chain).toBeObservable(result);
    })
  );
});
