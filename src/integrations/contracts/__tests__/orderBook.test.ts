import {describe, expect, it} from 'vitest';
import {parseFixed, parseUsdc} from '@/domain';
import {aggregateBookLevels, type BookEntry} from '../orderBook';

describe('aggregateBookLevels', () => {
  it('groups several whole-lot orders at one rate and calculates cumulative depth', () => {
    const lotNotionalRaw = parseUsdc('50');
    const entries: BookEntry[] = [
      {side: 'buyer', strikeRaw: parseFixed('1575'), remainingLots: 2n, lotNotionalRaw},
      {side: 'buyer', strikeRaw: parseFixed('1570'), remainingLots: 4n, lotNotionalRaw},
      {side: 'buyer', strikeRaw: parseFixed('1570'), remainingLots: 2n, lotNotionalRaw},
      {side: 'seller', strikeRaw: parseFixed('1570'), remainingLots: 1n, lotNotionalRaw},
      {side: 'seller', strikeRaw: parseFixed('1565'), remainingLots: 3n, lotNotionalRaw},
    ];

    const levels = aggregateBookLevels(entries);

    expect(levels.map((level) => level.strikeRaw)).toEqual([
      parseFixed('1575'),
      parseFixed('1570'),
      parseFixed('1565'),
    ]);
    expect(levels[1]).toMatchObject({
      buyerNotionalRaw: parseUsdc('300'),
      sellerNotionalRaw: parseUsdc('50'),
      buyerOrderCount: 2,
      sellerOrderCount: 1,
      cumulativeBuyerNotionalRaw: parseUsdc('400'),
      cumulativeSellerNotionalRaw: parseUsdc('200'),
    });
  });

  it('excludes zero remainders', () => {
    expect(aggregateBookLevels([
      {side: 'buyer', strikeRaw: parseFixed('1570'), remainingLots: 0n, lotNotionalRaw: parseUsdc('50')},
    ])).toEqual([]);
  });
});
