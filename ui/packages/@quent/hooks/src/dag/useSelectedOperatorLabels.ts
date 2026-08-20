// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useAtomValue, useSetAtom } from 'jotai';
import { selectedOperatorLabelsAtom } from '../atoms/dag';

export const useSelectedOperatorLabels = () => useAtomValue(selectedOperatorLabelsAtom);
export const useSetSelectedOperatorLabels = () => useSetAtom(selectedOperatorLabelsAtom);
