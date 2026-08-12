// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! Simulated NVTX capture for the query-engine simulator.
//!
//! Emits a verbatim [`NvtxEvent`] stream through the same context directory as
//! the model, without linking the Linux-only NVTX C injection layer.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};

use nvtx_bridge::NvtxEventEntity;
use nvtx_events::{NvtxColor, NvtxEvent, NvtxEventAttributes, NvtxMessage};
use quent_model::{ContextInner, Observer};
use uuid::Uuid;

/// Named NVTX domains used by the simulator.
pub mod domains {
    pub const QUERY_ENGINE: u64 = 1;
    pub const MEMORY: u64 = 2;
}

/// Named NVTX categories within [`domains::QUERY_ENGINE`] / [`domains::MEMORY`].
pub mod categories {
    pub const PLANNING: u32 = 1;
    pub const COMPUTE: u32 = 2;
    pub const IO: u32 = 3;
    pub const NETWORK: u32 = 4;
    pub const ALLOCATION: u32 = 1;
}

/// Side-stream NVTX emitter sharing a simulator context id.
pub struct NvtxCapture {
    context_id: Uuid,
    observer: Observer<NvtxEventEntity>,
    next_thread_id: AtomicU32,
    next_range_id: AtomicU64,
}

impl NvtxCapture {
    /// Discard every event. Used when the simulator exporter is no-op.
    pub fn noop(context_id: Uuid) -> Self {
        Self {
            context_id,
            observer: Observer::noop(),
            next_thread_id: AtomicU32::new(1),
            next_range_id: AtomicU64::new(1),
        }
    }

    /// Attach an NVTX stream to `context_id` using `provider`.
    pub fn try_new(
        context_id: Uuid,
        provider: &impl quent_model::io::ExporterProvider<NvtxEventEntity>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let inner = ContextInner::try_new(context_id)?;
        let observer =
            inner.block_on(async { inner.observer::<NvtxEventEntity>(provider).await })?;
        Ok(Self {
            context_id,
            observer,
            next_thread_id: AtomicU32::new(1),
            next_range_id: AtomicU64::new(1),
        })
    }

    /// Domain and category names the simulator ranges refer to.
    pub fn declare_schema(&self) {
        self.emit(NvtxEvent::DomainCreate {
            domain: domains::QUERY_ENGINE,
            name: "QueryEngine".to_owned(),
        });
        self.emit(NvtxEvent::DomainCreate {
            domain: domains::MEMORY,
            name: "Memory".to_owned(),
        });
        self.emit(NvtxEvent::NameCategory {
            domain: domains::QUERY_ENGINE,
            category: categories::PLANNING,
            name: "Planning".to_owned(),
        });
        self.emit(NvtxEvent::NameCategory {
            domain: domains::QUERY_ENGINE,
            category: categories::COMPUTE,
            name: "Compute".to_owned(),
        });
        self.emit(NvtxEvent::NameCategory {
            domain: domains::QUERY_ENGINE,
            category: categories::IO,
            name: "IO".to_owned(),
        });
        self.emit(NvtxEvent::NameCategory {
            domain: domains::QUERY_ENGINE,
            category: categories::NETWORK,
            name: "Network".to_owned(),
        });
        self.emit(NvtxEvent::NameCategory {
            domain: domains::MEMORY,
            category: categories::ALLOCATION,
            name: "Allocation".to_owned(),
        });
    }

    /// Allocate a stable simulated OS thread id and name it.
    pub fn name_thread(&self, name: &str) -> u32 {
        let thread_id = self.next_thread_id.fetch_add(1, Ordering::Relaxed);
        self.emit(NvtxEvent::NameThread {
            thread_id,
            name: name.to_owned(),
        });
        thread_id
    }

    pub fn mark(&self, domain: u64, message: &str, category: u32) {
        self.emit(NvtxEvent::Mark {
            domain,
            attributes: attributes(message, category),
        });
    }

    /// Push a nested per-thread range; popping happens when the guard drops.
    pub fn push(
        &self,
        domain: u64,
        thread_id: u32,
        message: &str,
        category: u32,
    ) -> NvtxPushGuard<'_> {
        self.emit(NvtxEvent::RangePush {
            domain,
            thread_id,
            attributes: attributes(message, category),
        });
        NvtxPushGuard {
            capture: self,
            domain,
            thread_id,
        }
    }

    /// Open a process-wide range; the matching end is emitted when the guard drops.
    pub fn start(&self, domain: u64, message: &str, category: u32) -> NvtxStartGuard<'_> {
        let range_id = self.next_range_id.fetch_add(1, Ordering::Relaxed);
        self.emit(NvtxEvent::RangeStart {
            domain,
            range_id,
            attributes: attributes(message, category),
        });
        NvtxStartGuard {
            capture: self,
            domain,
            range_id,
        }
    }

    fn emit(&self, event: NvtxEvent) {
        self.observer.emit(self.context_id, event);
    }
}

/// Pops the matching [`NvtxEvent::RangePush`] on drop.
pub struct NvtxPushGuard<'a> {
    capture: &'a NvtxCapture,
    domain: u64,
    thread_id: u32,
}

impl Drop for NvtxPushGuard<'_> {
    fn drop(&mut self) {
        self.capture.emit(NvtxEvent::RangePop {
            domain: self.domain,
            thread_id: self.thread_id,
        });
    }
}

/// Ends the matching [`NvtxEvent::RangeStart`] on drop.
pub struct NvtxStartGuard<'a> {
    capture: &'a NvtxCapture,
    domain: u64,
    range_id: u64,
}

impl Drop for NvtxStartGuard<'_> {
    fn drop(&mut self) {
        self.capture.emit(NvtxEvent::RangeEnd {
            domain: self.domain,
            range_id: self.range_id,
        });
    }
}

fn attributes(message: &str, category: u32) -> NvtxEventAttributes {
    NvtxEventAttributes {
        category,
        color: Some(category_color(category)),
        message: Some(NvtxMessage::String(message.to_owned())),
        payload: None,
    }
}

/// `NVTX_COLOR_ARGB` packed as `0xAARRGGBB`.
fn category_color(category: u32) -> NvtxColor {
    const ARGB: i32 = 1;
    let value = match category {
        categories::PLANNING => 0xFF7C_3AED,
        categories::COMPUTE => 0xFF25_63EB,
        categories::IO => 0xFF16_A34A,
        categories::NETWORK => 0xFFEA_580C,
        _ => 0xFF47_5569,
    };
    NvtxColor {
        color_type: ARGB,
        value,
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use nvtx_analyzer::NvtxModelBuilder;
    use quent_model::EventCallback;

    use super::*;

    #[test]
    fn nested_push_pop_reconstructs_two_spans() {
        let events = Arc::new(Mutex::new(Vec::<quent_model::Event<NvtxEventEntity>>::new()));
        let exporter = EventCallback::new({
            let events = Arc::clone(&events);
            move |event| events.lock().unwrap().push(event)
        });
        let context_id = Uuid::now_v7();
        {
            let nvtx = NvtxCapture::try_new(context_id, &exporter).unwrap();
            nvtx.declare_schema();
            let thread_id = nvtx.name_thread("worker-0");
            let _outer = nvtx.push(
                domains::QUERY_ENGINE,
                thread_id,
                "task",
                categories::COMPUTE,
            );
            let _inner = nvtx.push(domains::MEMORY, thread_id, "alloc", categories::ALLOCATION);
        }

        let captured = std::mem::take(&mut *events.lock().unwrap());
        assert!(
            captured
                .iter()
                .any(|event| matches!(event.data.0, NvtxEvent::RangePush { .. }))
        );
        assert!(
            captured
                .iter()
                .any(|event| matches!(event.data.0, NvtxEvent::RangePop { .. }))
        );

        let model = NvtxModelBuilder::build(captured);
        assert_eq!(model.spans().len(), 2);
        assert!(model.anomalies().is_faithful());
    }
}
