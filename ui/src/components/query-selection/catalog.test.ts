// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  catalogAttributeKeys,
  filterCatalogItems,
  groupCatalogItems,
  type CatalogEntity,
} from './catalog';

const items: CatalogEntity[] = [
  {
    id: 'query-1',
    instance_name: 'Scan orders',
    custom_attributes: [
      { key: 'workload', value: 'nightly' },
      { key: 'rows', value: 42 },
    ],
  },
  {
    id: 'query-2',
    instance_name: 'Aggregate sales',
    custom_attributes: [{ key: 'workload', value: 'interactive' }],
  },
  {
    id: 'query-3',
    instance_name: null,
    custom_attributes: [],
  },
];

describe('catalog helpers', () => {
  it('derives attribute columns in first-seen order', () => {
    expect(catalogAttributeKeys(items)).toEqual(['workload', 'rows']);
  });

  it('searches names, ids, keys, and formatted values', () => {
    expect(filterCatalogItems(items, 'orders').map(item => item.id)).toEqual(['query-1']);
    expect(filterCatalogItems(items, 'interactive').map(item => item.id)).toEqual(['query-2']);
    expect(filterCatalogItems(items, 'rows').map(item => item.id)).toEqual(['query-1']);
    expect(filterCatalogItems(items, 'query-3').map(item => item.id)).toEqual(['query-3']);
  });

  it('groups missing values under Other while preserving row order', () => {
    expect(groupCatalogItems(items, 'workload')).toEqual([
      { id: 'nightly', label: 'nightly', items: [items[0]] },
      { id: 'interactive', label: 'interactive', items: [items[1]] },
      { id: '__other__', label: 'Other', items: [items[2]] },
    ]);
  });
});
