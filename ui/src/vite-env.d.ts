// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_QUERY_DIFF?: string;
  readonly TEST?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
