# Query Profile Diff API

The query profile diff APIs compare two query profiles from the same engine.
The UI also uses the profile diff contract as its internal diff view model when
it builds query diffs client-side from real `QueryBundle` API responses.

## Profile Diff Endpoint

```http
POST /api/engines/{engine_id}/query-profile-diff
```

### Request

```ts
export interface QueryProfileDiffRequest {
  query_a_id: string;
  query_b_id: string;
}
```

Query A is the baseline. Numeric deltas are always `A - B`.

### Response

```ts
export type QueryProfileDiffScenario =
  | "plans_equal"
  | "plans_different"
  | "plans_incomparable";

export interface QueryProfileDiffQuerySummary {
  id: string;
  instance_name: string | null;
  query_group_id?: string | null;
  query_group_name?: string | null;
}

export interface QueryProfileDiffOperatorRef {
  id: string;
  label: string;
  operator_type_name: string | null;
  plan_id: string | null;
}

export interface QueryProfileDiffStatDelta {
  a: StatValue;
  b: StatValue;
  delta: number | null;
  percent_delta: number | null;
}

export interface QueryProfileDiffOperatorDelta {
  operator_a: QueryProfileDiffOperatorRef | null;
  operator_b: QueryProfileDiffOperatorRef | null;
  stats: Record<string, QueryProfileDiffStatDelta>;
}

export interface QueryProfileDiffPlanComparison {
  matched_operator_count: number;
  unmatched_operator_a_count: number;
  unmatched_operator_b_count: number;
}

export interface QueryProfileDiffResponse {
  scenario: QueryProfileDiffScenario;
  query_a: QueryProfileDiffQuerySummary;
  query_b: QueryProfileDiffQuerySummary;
  plan_comparison: QueryProfileDiffPlanComparison;
  operator_diffs: QueryProfileDiffOperatorDelta[];
  warnings?: string[];
}
```

`StatValue` comes from the UI utility types and may be a string, number,
boolean, null, or string array. Numeric stats include `delta` and
`percent_delta`; non-numeric or missing values use `delta: null`.
`percent_delta` is `delta / b` when B is numeric and nonzero, otherwise null.

## Timeline Diff Endpoint

```http
POST /api/engines/{engine_id}/timeline/diff
```

The timeline diff endpoint accepts two or more single-timeline requests,
returns each requested timeline, and adds a derived delta timeline.

### Request

```ts
export type QueryProfileDiffTimelineEntries<T> = [T, T, ...T[]];

export interface QueryProfileDiffTimelineRequest {
  timelines: QueryProfileDiffTimelineEntries<
    SingleTimelineRequest<QueryFilter, TaskFilter>
  >;
  delta_config: TimelineConfig;
}
```

`timelines` must contain at least Query A and Query B entries. Additional
entries may be included when the caller needs the same request/response bundle
for overlays or comparison context. `delta_config` controls the output window
and binning for the derived delta timeline.

### Response

```ts
export interface QueryProfileDiffTimelineResponse {
  timelines: QueryProfileDiffTimelineEntries<SingleTimelineResponse>;
  delta: SingleTimelineResponse;
  warnings?: string[];
}
```

The first response in `timelines` corresponds to Query A and the second
corresponds to Query B. The `delta` timeline is sampled into `delta_config`.
The current implementation represents the delta as binned positive magnitudes:
one series for where Query A is higher and one series for where Query B is
higher.

## V1 Semantics

- `plans_equal` means a structural match: topology plus ordered operator
  type/name signatures match, ignoring run-specific IDs.
- `operator_diffs` contains matched operator pairs for equal plans.
- Numeric stats include `delta` and optional `percent_delta`; non-numeric or
  missing values use `delta: null`.
- `plans_different` means operator-to-operator diffs are unavailable. The
  response reports matched and unmatched counts and may include a warning.
- `plans_incomparable` is reserved for profiles that cannot be compared, such
  as unsupported or missing plan data.
- Different-plan aggregate rows are a planned follow-up.

## Client Surface

The TypeScript client exposes:

```ts
fetchQueryProfileDiff(engineId, request)
fetchQueryProfileDiffTimeline(engineId, request)
useQueryProfileDiff(params, options?)
useQueryProfileDiffTimeline(params, options?)
```

The current UI can also build a `QueryProfileDiffResponse` locally from two
`QueryBundle` responses. That local path uses the same response contract so the
table, stats, and timeline views can consume either API-backed or client-built
diffs.
