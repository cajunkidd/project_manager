import { PRIORITIES, comparePriority, isPriority } from '../src/validators/priority';

describe('priority validator', () => {
  it.each(PRIORITIES)('accepts %s as a valid priority', (priority) => {
    expect(isPriority(priority)).toBe(true);
  });

  it.each(['LOW', 'medium', '', null, undefined, 1])(
    'rejects invalid priority: %p',
    (value) => {
      expect(isPriority(value)).toBe(false);
    },
  );
});

describe('comparePriority', () => {
  it('orders low < normal < high < urgent', () => {
    const sorted = [...PRIORITIES].sort(comparePriority);
    expect(sorted).toEqual(['low', 'normal', 'high', 'urgent']);
  });

  it('returns 0 for equal priorities', () => {
    expect(comparePriority('high', 'high')).toBe(0);
  });

  it('returns a negative number when a is lower than b', () => {
    expect(comparePriority('low', 'urgent')).toBeLessThan(0);
  });

  it('returns a positive number when a is higher than b', () => {
    expect(comparePriority('urgent', 'normal')).toBeGreaterThan(0);
  });
});
