// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

use super::*;

#[derive(Default)]
pub(crate) struct EngineAccumulator {
    pub(crate) instance_name: Option<String>,
    pub(crate) implementation: Option<schema::EngineImplementationAttributes>,
    pub(crate) workers: Option<u64>,
    pub(crate) threads_per_worker: Option<u64>,
    pub(crate) gpus_per_worker: Option<u64>,
    pub(crate) num_workloads: Option<u64>,
    pub(crate) num_queries: Option<u64>,
    pub(crate) exited: bool,
}

impl EntityEventAccumulator for EngineAccumulator {
    type Payload = schema::EngineEvent;

    fn push(&mut self, event: Self::Payload) {
        match event {
            schema::EngineEvent::Init {
                implementation,
                instance_name,
                workers,
                threads_per_worker,
                gpus_per_worker,
                num_workloads,
                num_queries,
            } => {
                self.instance_name = instance_name;
                self.implementation = Some(implementation);
                self.workers = Some(workers);
                self.threads_per_worker = Some(threads_per_worker);
                self.gpus_per_worker = Some(gpus_per_worker);
                self.num_workloads = Some(num_workloads);
                self.num_queries = Some(num_queries);
            }
            schema::EngineEvent::Exit => self.exited = true,
        }
    }
}

#[derive(Debug)]
pub struct Engine(AnalyzedEntity<EngineAccumulator>);

impl Engine {
    pub(crate) fn try_from_event(event: Event<schema::EngineEvent>) -> AnalyzerResult<Self> {
        Ok(Self(AnalyzedEntity::try_from_event(event)?))
    }

    pub(crate) fn push(&mut self, event: Event<schema::EngineEvent>) -> AnalyzerResult<()> {
        self.0.push(event)
    }

    pub(crate) fn data(&self) -> &EngineAccumulator {
        self.0.accumulator()
    }
}

impl Entity for Engine {
    fn id(&self) -> Uuid {
        self.0.id()
    }

    fn type_name(&self) -> &str {
        self.0.type_name()
    }

    fn earliest_timestamp(&self) -> TimeUnixNanoSec {
        self.0.earliest_timestamp()
    }

    fn latest_timestamp(&self) -> TimeUnixNanoSec {
        self.0.latest_timestamp()
    }
}

impl RefTreeEntity for Engine {
    fn parent_id(&self) -> Option<Uuid> {
        None
    }
}

impl EngineEntity for Engine {
    fn to_ui(&self) -> AnalyzerResult<query_engine_ui::Engine> {
        let data = self.data();
        let start = self.earliest_timestamp();
        let duration_s = data
            .exited
            .then(|| try_to_secs_relative(self.latest_timestamp(), start))
            .transpose()?;
        Ok(query_engine_ui::Engine {
            id: self.id(),
            start_time_unix_ns: Some(start),
            duration_s,
            instance_name: data.instance_name.clone(),
            custom_attributes: [
                data.workers
                    .map(|value| DynamicAttribute::u64("workers", value)),
                data.threads_per_worker
                    .map(|value| DynamicAttribute::u64("threads_per_worker", value)),
                data.gpus_per_worker
                    .map(|value| DynamicAttribute::u64("gpus_per_worker", value)),
                data.num_workloads
                    .map(|value| DynamicAttribute::u64("num_workloads", value)),
                data.num_queries
                    .map(|value| DynamicAttribute::u64("num_queries", value)),
            ]
            .into_iter()
            .flatten()
            .collect(),
            implementation: data.implementation.as_ref().map(|implementation| {
                query_engine_ui::EngineImplementationAttributes {
                    name: implementation.name.clone(),
                    version: implementation.version.clone(),
                    custom_attributes: implementation.custom_attributes.0.clone(),
                }
            }),
        })
    }
}
