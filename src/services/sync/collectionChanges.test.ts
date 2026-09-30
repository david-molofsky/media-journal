import { describe, expect, it } from 'vitest';
import { collectionChanges } from './collectionChanges';

describe('cloud collection changes', () => {
  it('writes only changed records and removes missing records', () => {
    const current = new Map<string, unknown>([
      ['same', { id: 'same', metadata: { source: 'Cinema', rating: 8 } }],
      ['changed', { id: 'changed', title: 'Before' }],
      ['removed', { id: 'removed' }],
    ]);
    const wanted = [
      { id: 'same', value: { metadata: { rating: 8, source: 'Cinema' }, id: 'same' } },
      { id: 'changed', value: { id: 'changed', title: 'After' } },
      { id: 'added', value: { id: 'added' } },
    ];

    expect(collectionChanges<Record<string, unknown>>(current, wanted)).toEqual({
      toDelete: ['removed'],
      toSet: wanted.slice(1),
    });
  });

  it('does not write anything when a snapshot is unchanged', () => {
    expect(
      collectionChanges(new Map([['one', { id: 'one' }]]), [
        { id: 'one', value: { id: 'one' } },
      ]),
    ).toEqual({ toDelete: [], toSet: [] });
  });
});
