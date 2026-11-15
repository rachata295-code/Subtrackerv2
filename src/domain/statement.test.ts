import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import { statementFor } from './index';

const card = financeFixture.sources.find((s) => s.kind === 'credit_card')!;
const spay = financeFixture.sources.find((s) => s.kind === 'paylater')!;

describe('statementFor', () => {
  it('maps credit card charges on Oct 25, Nov 1, and Nov 3 to closing key 2026-11 due Nov 24', () => {
    const expected = {
      key: '2026-11',
      start: '2026-10-10',
      end: '2026-11-09',
      dueDate: '2026-11-24',
    };
    expect(statementFor(card, '2026-10-25')).toEqual(expected);
    expect(statementFor(card, '2026-11-01')).toEqual(expected);
    expect(statementFor(card, '2026-11-03')).toEqual(expected);
    expect(statementFor(card, '2026-11-09')).toEqual(expected);
  });

  it('rolls credit card charge on closing day Nov 10 into 2026-12 due Dec 24', () => {
    expect(statementFor(card, '2026-11-10')).toEqual({
      key: '2026-12',
      start: '2026-11-10',
      end: '2026-12-09',
      dueDate: '2026-12-24',
    });
  });

  it('rolls credit card December charges after closeDay into next year 2027-01', () => {
    expect(statementFor(card, '2026-12-15')).toEqual({
      key: '2027-01',
      start: '2026-12-10',
      end: '2027-01-09',
      dueDate: '2027-01-24',
    });
  });

  it('maps SPayLater calendar month November charges to key 2026-11 due Dec 10', () => {
    const expected = {
      key: '2026-11',
      start: '2026-11-01',
      end: '2026-11-30',
      dueDate: '2026-12-10',
    };
    expect(statementFor(spay, '2026-11-01')).toEqual(expected);
    expect(statementFor(spay, '2026-11-30')).toEqual(expected);
  });

  it('handles SPayLater across year boundary and February', () => {
    expect(statementFor(spay, '2026-12-20')).toEqual({
      key: '2026-12',
      start: '2026-12-01',
      end: '2026-12-31',
      dueDate: '2027-01-10',
    });
    expect(statementFor(spay, '2026-02-14')).toEqual({
      key: '2026-02',
      start: '2026-02-01',
      end: '2026-02-28',
      dueDate: '2026-03-10',
    });
  });
});
