// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

use std::collections::HashMap;

use quent_query_engine_ui as ui;
use quent_time::TimeSec;
use uuid::Uuid;

/// Per-query operator data needed to compute a diff.
///
/// Returned by [`UiAnalyzer::query_operator_stats`].
pub struct QueryOperatorStats {
    pub engine_id: Uuid,
    pub engine_name: Option<String>,
    pub instance_name: Option<String>,
    pub query_group_id: Option<Uuid>,
    pub query_group_name: Option<String>,
    pub duration_s: TimeSec,
    /// All operators that worked on this query, keyed by operator ID.
    pub operators: HashMap<Uuid, ui::Operator>,
}
