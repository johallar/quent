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

/// Domain `0` is NVTX's unnamed default; named libraries occupy `1..`.
const DOMAIN_NAMES: &[&str] = &[
    "default domain",
    "CCCL",
    "libcudf",
    "CUB",
    "NCCL",
    "cuBLAS",
    "Thrust",
];

const CATEGORY_NAMES: &[&str] = &["API", "Internal", "Memory", "Compute", "IO"];

const LIBCUDF_FRAMES: &[&str] = &[
    "read_parquet",
    "read_chunk_internal",
    "decode_page_data",
    "preprocess_subpages",
    "build_string_dict_ind",
    "copy_if",
    "finalize_output",
    "binary_operation",
];

const CCCL_KERNELS: &[&str] = &[
    "thrust copy_if",
    "thrust::transform",
    "cub::DeviceReduce",
    "cub::DeviceScan",
    "throw",
];

/// Start from a plausible Linux TID so unnamed threads render as `thread 186143`.
const OS_THREAD_BASE: u32 = 186_143;

/// How many NVTX domains, categories, marks, and extra nested ranges to emit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NvtxLayout {
    /// Distinct domains to declare. `0` disables NVTX emission.
    pub num_domains: usize,
    /// Named categories declared in every domain. `0` leaves ranges uncategorized.
    pub num_categories: usize,
    /// Instant marks emitted per query.
    pub num_marks: usize,
    /// Extra nested libcudf frames inside each scan.
    pub num_nested_ranges: usize,
}

impl Default for NvtxLayout {
    fn default() -> Self {
        Self {
            num_domains: 3,
            num_categories: 0,
            num_marks: 0,
            num_nested_ranges: 0,
        }
    }
}

/// Side-stream NVTX emitter sharing a simulator context id.
pub struct NvtxCapture {
    context_id: Uuid,
    observer: Observer<NvtxEventEntity>,
    layout: NvtxLayout,
    next_thread_id: AtomicU32,
    next_range_id: AtomicU64,
}

impl NvtxCapture {
    /// Discard every event. Used when the simulator exporter is no-op.
    pub fn noop(context_id: Uuid, layout: NvtxLayout) -> Self {
        Self {
            context_id,
            observer: Observer::noop(),
            layout,
            next_thread_id: AtomicU32::new(OS_THREAD_BASE),
            next_range_id: AtomicU64::new(1),
        }
    }

    /// Attach an NVTX stream to `context_id` using `provider`.
    pub fn try_new(
        context_id: Uuid,
        provider: &impl quent_model::io::ExporterProvider<NvtxEventEntity>,
        layout: NvtxLayout,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let inner = ContextInner::try_new(context_id)?;
        let observer =
            inner.block_on(async { inner.observer::<NvtxEventEntity>(provider).await })?;
        Ok(Self {
            context_id,
            observer,
            layout,
            next_thread_id: AtomicU32::new(OS_THREAD_BASE),
            next_range_id: AtomicU64::new(1),
        })
    }

    pub fn layout(&self) -> NvtxLayout {
        self.layout
    }

    /// Domain handle `0..num_domains`, wrapping `index`. `0` is the default domain.
    pub fn domain_at(&self, index: usize) -> u64 {
        match self.layout.num_domains {
            0 => 0,
            n => (index % n) as u64,
        }
    }

    /// Domain `index` when it was declared; `None` if the layout is smaller.
    pub fn try_domain(&self, index: usize) -> Option<u64> {
        (index < self.layout.num_domains).then_some(index as u64)
    }

    /// Category id `1..=num_categories`, wrapping `index`. `0` when none were declared.
    pub fn category_at(&self, index: usize) -> u32 {
        match self.layout.num_categories {
            0 => 0,
            n => 1 + (index % n) as u32,
        }
    }

    pub fn cccl_kernel_name(index: usize) -> &'static str {
        CCCL_KERNELS[index % CCCL_KERNELS.len()]
    }

    /// Domain and category names matching [`Self::domain_at`] / [`Self::category_at`].
    pub fn declare_schema(&self) {
        for domain in 0..self.layout.num_domains as u64 {
            if domain != 0 {
                self.emit(NvtxEvent::DomainCreate {
                    domain,
                    name: domain_name(domain),
                });
            }
            for category in 1..=self.layout.num_categories as u32 {
                self.emit(NvtxEvent::NameCategory {
                    domain,
                    category,
                    name: category_name(category),
                });
            }
        }
    }

    /// Allocate a raw OS thread id without naming it (renders as `thread {id}`).
    pub fn alloc_thread(&self) -> u32 {
        self.next_thread_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Allocate a stable simulated OS thread id and name it.
    pub fn name_thread(&self, name: &str) -> u32 {
        let thread_id = self.alloc_thread();
        self.emit(NvtxEvent::NameThread {
            thread_id,
            name: name.to_owned(),
        });
        thread_id
    }

    pub fn mark(&self, domain: u64, message: &str, category: u32) {
        self.emit(NvtxEvent::Mark {
            domain,
            attributes: attributes(domain, message, category),
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
            attributes: attributes(domain, message, category),
        });
        NvtxPushGuard {
            capture: self,
            domain,
            thread_id,
        }
    }

    /// Extra libcudf frames that pop innermost-first when the stack drops.
    pub fn push_nested(&self, thread_id: u32, count: usize) -> NvtxPushStack<'_> {
        let Some(domain) = self.try_domain(2) else {
            return NvtxPushStack { guards: Vec::new() };
        };
        NvtxPushStack {
            guards: (0..count)
                .map(|index| {
                    let name = LIBCUDF_FRAMES[index % LIBCUDF_FRAMES.len()];
                    self.push(domain, thread_id, name, self.category_at(index))
                })
                .collect(),
        }
    }

    /// Open a process-wide range; the matching end is emitted when the guard drops.
    pub fn start(&self, domain: u64, message: &str, category: u32) -> NvtxStartGuard<'_> {
        let range_id = self.next_range_id.fetch_add(1, Ordering::Relaxed);
        self.emit(NvtxEvent::RangeStart {
            domain,
            range_id,
            attributes: attributes(domain, message, category),
        });
        NvtxStartGuard {
            capture: self,
            domain,
            range_id,
        }
    }

    fn emit(&self, event: NvtxEvent) {
        if self.layout.num_domains == 0 {
            return;
        }
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

/// Nested push guards that drop innermost first, matching NVTX's per-thread stack.
pub struct NvtxPushStack<'a> {
    guards: Vec<NvtxPushGuard<'a>>,
}

impl Drop for NvtxPushStack<'_> {
    fn drop(&mut self) {
        while self.guards.pop().is_some() {}
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

fn domain_name(domain: u64) -> String {
    DOMAIN_NAMES
        .get(domain as usize)
        .copied()
        .map(str::to_owned)
        .unwrap_or_else(|| format!("domain-{domain}"))
}

fn category_name(category: u32) -> String {
    CATEGORY_NAMES
        .get(category.saturating_sub(1) as usize)
        .copied()
        .map(str::to_owned)
        .unwrap_or_else(|| format!("category-{category}"))
}

fn attributes(domain: u64, message: &str, category: u32) -> NvtxEventAttributes {
    NvtxEventAttributes {
        category,
        color: Some(domain_color(domain)),
        message: Some(NvtxMessage::String(message.to_owned())),
        payload: None,
    }
}

/// `NVTX_COLOR_ARGB` packed as `0xAARRGGBB`. Default blue, CCCL red, libcudf purple.
fn domain_color(domain: u64) -> NvtxColor {
    const ARGB: i32 = 1;
    const PALETTE: [u32; 7] = [
        0xFF25_63EB,
        0xFFDC_2626,
        0xFF7C_3AED,
        0xFFEA_580C,
        0xFF16_A34A,
        0xFF0D_9488,
        0xFF08_91B2,
    ];
    NvtxColor {
        color_type: ARGB,
        value: PALETTE[(domain as usize) % PALETTE.len()],
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use nvtx_analyzer::NvtxModelBuilder;
    use quent_model::EventCallback;

    use super::*;

    fn collect(
        layout: NvtxLayout,
        body: impl FnOnce(&NvtxCapture),
    ) -> Vec<quent_model::Event<NvtxEventEntity>> {
        let events = Arc::new(Mutex::new(Vec::<quent_model::Event<NvtxEventEntity>>::new()));
        let exporter = EventCallback::new({
            let events = Arc::clone(&events);
            move |event| events.lock().unwrap().push(event)
        });
        let context_id = Uuid::now_v7();
        {
            let nvtx = NvtxCapture::try_new(context_id, &exporter, layout).unwrap();
            body(&nvtx);
        }
        std::mem::take(&mut *events.lock().unwrap())
    }

    #[test]
    fn nested_push_pop_reconstructs_two_spans() {
        let captured = collect(NvtxLayout::default(), |nvtx| {
            nvtx.declare_schema();
            let thread_id = nvtx.alloc_thread();
            let _outer = nvtx.push(nvtx.domain_at(0), thread_id, "task", nvtx.category_at(1));
            let _inner = nvtx.push(nvtx.domain_at(1), thread_id, "alloc", nvtx.category_at(0));
        });
        let model = NvtxModelBuilder::build(captured);
        assert_eq!(model.spans().len(), 2);
        assert!(model.anomalies().is_faithful());
    }

    #[test]
    fn schema_declares_named_domains_skipping_default() {
        let layout = NvtxLayout {
            num_domains: 3,
            num_categories: 2,
            num_marks: 0,
            num_nested_ranges: 0,
        };
        let captured = collect(layout, |nvtx| nvtx.declare_schema());
        let domains: Vec<_> = captured
            .iter()
            .filter_map(|event| match &event.data.0 {
                NvtxEvent::DomainCreate { domain, name } => Some((*domain, name.as_str())),
                _ => None,
            })
            .collect();
        let categories = captured
            .iter()
            .filter(|event| matches!(event.data.0, NvtxEvent::NameCategory { .. }))
            .count();
        assert_eq!(domains, vec![(1, "CCCL"), (2, "libcudf")]);
        assert_eq!(categories, 6);
    }

    #[test]
    fn zero_domains_emits_nothing() {
        let captured = collect(
            NvtxLayout {
                num_domains: 0,
                num_categories: 4,
                num_marks: 8,
                num_nested_ranges: 8,
            },
            |nvtx| {
                nvtx.declare_schema();
                nvtx.mark(1, "nope", 1);
            },
        );
        assert!(captured.is_empty());
    }
}
