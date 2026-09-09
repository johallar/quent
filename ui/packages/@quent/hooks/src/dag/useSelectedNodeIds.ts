// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useAtomValue } from 'jotai';
import { selectedNodeIdsAtom } from '../atoms/dag';

export const useSelectedNodeIds = () => useAtomValue(selectedNodeIdsAtom);
