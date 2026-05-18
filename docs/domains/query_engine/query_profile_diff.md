# Query Profile Diff API

The query profile diff API compares two query profiles from the same engine.
The UI uses this contract through a mock endpoint first; generated TypeScript
bindings should replace the temporary client-side types once the Rust endpoint
exports these shapes.

## Endpoint

```http
POST /api/engines/{engine_id}/query-profile-diff
```

## Request

```ts
export interface QueryProfileDiffRequest {
  query_a_id: string;
  query_b_id: string;
}
```

Query A is the baseline. Numeric deltas are always `A - B`.

## Response

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
  match_kind: "structural" | "different" | "incomparable";
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

## V1 Semantics

- `plans_equal` means a structural match: topology plus ordered operator
  type/name signatures match, ignoring run-specific IDs.
- `operator_diffs` contains matched operator pairs for equal plans.
- Numeric stats include `delta` and optional `percent_delta`; non-numeric or
  missing values use `delta: null`.
- Different-plan aggregate rows and timeline deltas are planned follow-ups.
