import { describe, expect, it } from 'vitest';
import { countVersionDiffs, parseMetadataChanges, parsePropertyChanges } from './versionDiff';
import type { EventVersionDetail } from '../types/api';

describe('versionDiff', () => {
  const diff: EventVersionDetail['diff'] = {
    metadata: {
      description: { from: '', to: 'Tracks checkout entry' },
      is_archived: { from: false, to: true },
    },
    properties: {
      added: [
        {
          property_name: 'cart_total',
          property_type: 'event',
          data_type: 'Float',
          is_required: false,
          example_value: '149.99',
          description: 'Current cart total',
        },
      ],
      removed: [],
      updated: [
        {
          key: 'cart_id:event',
          before: {
            property_name: 'cart_id',
            property_type: 'event',
            data_type: 'String',
            is_required: false,
            example_value: '',
            description: '',
          },
          after: {
            property_name: 'cart_id',
            property_type: 'event',
            data_type: 'UUID',
            is_required: true,
            example_value: 'c2f7',
            description: 'Stable cart identifier',
          },
        },
      ],
    },
  };

  it('parses metadata changes into readable summaries', () => {
    expect(parseMetadataChanges(diff)).toEqual([
      {
        field: 'description',
        label: 'Description',
        from: 'Empty',
        to: 'Tracks checkout entry',
        summary: 'Description set to Tracks checkout entry',
      },
      {
        field: 'is_archived',
        label: 'Status',
        from: 'Active',
        to: 'Archived',
        summary: 'Status changed from Active to Archived',
      },
    ]);
  });

  it('parses property changes and counts them', () => {
    const propertyChanges = parsePropertyChanges(diff);

    expect(countVersionDiffs(diff)).toEqual({
      metadata: 2,
      added: 1,
      removed: 0,
      updated: 1,
    });

    expect(propertyChanges[0]).toMatchObject({
      kind: 'added',
      name: 'cart_total',
      summary: 'Added cart_total',
    });

    expect(propertyChanges[1]).toMatchObject({
      kind: 'updated',
      name: 'cart_id',
      summary: 'Updated cart_id',
    });
    expect(propertyChanges[1].fieldChanges).toEqual([
      { field: 'data_type', label: 'Type', from: 'String', to: 'UUID' },
      { field: 'is_required', label: 'Required', from: 'No', to: 'Yes' },
      { field: 'example_value', label: 'Example', from: 'Empty', to: 'c2f7' },
      { field: 'description', label: 'Description', from: 'Empty', to: 'Stable cart identifier' },
    ]);
  });
});
