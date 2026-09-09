// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useAtomValue } from 'jotai';
import { selectedOperatorLabelAtom } from '../atoms/dag';

export const useSelectedOperatorLabel = () => useAtomValue(selectedOperatorLabelAtom);
