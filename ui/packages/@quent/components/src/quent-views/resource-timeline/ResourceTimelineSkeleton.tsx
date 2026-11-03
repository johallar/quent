// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Skeleton } from '../../ui/skeleton';

/** Animated placeholder for resource timeline data. */
export function TimelineSkeleton() {
  return (
    <div className="relative h-full w-full">
      <div
        className="absolute rounded-sm bg-muted/30"
        style={{ left: 40, right: 10, top: 10, bottom: 30 }}
      >
        <div className="absolute inset-0 flex items-end overflow-hidden px-2 pb-2">
          {Array.from({ length: 24 }).map((_, index) => (
            <Skeleton
              key={index}
              className="mx-0.5 flex-1 rounded-t-sm"
              style={{
                height: `${30 + Math.sin(index * 0.5) * 20 + Math.random() * 25}%`,
                animationDelay: `${index * 50}ms`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="absolute left-0 top-2.5 flex h-[calc(100%-40px)] flex-col justify-between">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="absolute bottom-1.5 left-10 right-2.5 flex justify-between">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}
