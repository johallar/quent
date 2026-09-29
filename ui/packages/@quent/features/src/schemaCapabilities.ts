// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Annotations, DataType, Field, Schema } from '@quent/schema';
import {
  FEATURE_IDS,
  defineFeatureSet,
  type BuiltInFeatureId,
  type FeatureRegistration,
  type FeatureSet,
} from './registry';

const FSM_CONSTRAINT = 'quent.fsm.v0.1.0';
const REFERENCE_TREE_CONSTRAINT = 'quent.ref-tree.v0.1.0';
const RESOURCE_CONSTRAINT = 'quent.resource.v0.1.0';
const QUERY_PLAN_ENTITY_NAMES = ['Plan', 'Operator', 'Port'] as const;

export type FeatureResolutionSource = 'schema' | 'host' | 'derived' | 'unavailable';

export interface FeatureResolutionDecision {
  readonly id: BuiltInFeatureId;
  readonly enabled: boolean;
  readonly source: FeatureResolutionSource;
  readonly evidence: string;
}

export interface SchemaFeatureResolution {
  readonly featureSet: FeatureSet;
  readonly decisions: readonly FeatureResolutionDecision[];
}

export interface SchemaFeatureResolutionOptions {
  readonly hostFeatures?: readonly BuiltInFeatureId[];
}

function hasConstraint(annotations: Annotations, constraintName: string): boolean {
  return constraintName in annotations.constraints;
}

function dataTypeHasConstraint(dataType: DataType, constraintName: string): boolean {
  if (typeof dataType === 'string') {
    return false;
  }
  if ('Option' in dataType) {
    return dataTypeHasConstraint(dataType.Option, constraintName);
  }
  if ('List' in dataType) {
    return dataTypeHasConstraint(dataType.List, constraintName);
  }
  if ('EntityRef' in dataType) {
    return hasConstraint(dataType.EntityRef.annotations, constraintName);
  }
  return false;
}

function fieldsHaveConstraint(
  fields: Readonly<Record<string, Field>>,
  constraintName: string
): boolean {
  return Object.values(fields).some(
    field =>
      hasConstraint(field.annotations, constraintName) ||
      dataTypeHasConstraint(field.ty, constraintName)
  );
}

function schemaHasConstraint(schema: Schema, constraintName: string): boolean {
  return (
    hasConstraint(schema.annotations, constraintName) ||
    schema.entities.some(([, entity]) => {
      if (hasConstraint(entity.annotations, constraintName)) {
        return true;
      }
      return Object.values(entity.events).some(
        event =>
          hasConstraint(event.annotations, constraintName) ||
          fieldsHaveConstraint(event.payload, constraintName)
      );
    }) ||
    schema.records.some(
      ([, record]) =>
        hasConstraint(record.annotations, constraintName) ||
        fieldsHaveConstraint(record.fields, constraintName)
    )
  );
}

function schemaHasQueryPlanShape(schema: Schema): boolean {
  const entityNames = new Set(schema.entities.map(([path]) => path.name));
  return QUERY_PLAN_ENTITY_NAMES.every(entityName => entityNames.has(entityName));
}

function decision(
  id: BuiltInFeatureId,
  enabled: boolean,
  source: FeatureResolutionSource,
  evidence: string
): FeatureResolutionDecision {
  return { id, enabled, source, evidence };
}

export function resolveFeatureSetFromSchema(
  schema: Schema,
  options: SchemaFeatureResolutionOptions = {}
): SchemaFeatureResolution {
  const hostFeatures = new Set(options.hostFeatures ?? []);
  const hasFsm = schemaHasConstraint(schema, FSM_CONSTRAINT);
  const hasReferenceTree = schemaHasConstraint(schema, REFERENCE_TREE_CONSTRAINT);
  const hasResourceConstraint = schemaHasConstraint(schema, RESOURCE_CONSTRAINT);
  const hasResource = hasResourceConstraint && hasFsm && hasReferenceTree;
  const hasQueryEngineCore = hostFeatures.has(FEATURE_IDS.queryEngineCore);
  const hasQueryPlanShape = schemaHasQueryPlanShape(schema);
  const hasQueryPlan = hasQueryEngineCore && hasQueryPlanShape;
  const hasQueryEngineResource = hasQueryEngineCore && hasResource;

  const features: FeatureRegistration[] = [];
  if (hasQueryEngineCore) {
    features.push({ id: FEATURE_IDS.queryEngineCore });
  }
  if (hasFsm) {
    features.push({ id: FEATURE_IDS.fsm });
  }
  if (hasReferenceTree) {
    features.push({ id: FEATURE_IDS.referenceTree });
  }
  if (hasResource) {
    features.push({
      id: FEATURE_IDS.resource,
      dependencies: [FEATURE_IDS.fsm, FEATURE_IDS.referenceTree],
    });
  }
  if (hasQueryEngineResource) {
    features.push({
      id: FEATURE_IDS.queryEngineResource,
      dependencies: [FEATURE_IDS.queryEngineCore, FEATURE_IDS.resource],
    });
  }
  if (hasQueryPlan) {
    features.push({
      id: FEATURE_IDS.queryPlan,
      dependencies: [FEATURE_IDS.queryEngineCore],
    });
  }

  return {
    featureSet: defineFeatureSet(features),
    decisions: [
      decision(
        FEATURE_IDS.queryEngineCore,
        hasQueryEngineCore,
        hasQueryEngineCore ? 'host' : 'unavailable',
        hasQueryEngineCore
          ? 'The query-engine host supplied this capability.'
          : 'The host did not supply query-engine-core.'
      ),
      decision(
        FEATURE_IDS.fsm,
        hasFsm,
        hasFsm ? 'schema' : 'unavailable',
        hasFsm ? `Found ${FSM_CONSTRAINT}.` : `Missing ${FSM_CONSTRAINT}.`
      ),
      decision(
        FEATURE_IDS.referenceTree,
        hasReferenceTree,
        hasReferenceTree ? 'schema' : 'unavailable',
        hasReferenceTree
          ? `Found ${REFERENCE_TREE_CONSTRAINT}.`
          : `Missing ${REFERENCE_TREE_CONSTRAINT}.`
      ),
      decision(
        FEATURE_IDS.resource,
        hasResource,
        hasResource ? 'schema' : 'unavailable',
        hasResource
          ? `Found ${RESOURCE_CONSTRAINT} with FSM and reference-tree support.`
          : `Resource requires ${RESOURCE_CONSTRAINT}, FSM, and reference-tree support.`
      ),
      decision(
        FEATURE_IDS.queryEngineResource,
        hasQueryEngineResource,
        hasQueryEngineResource ? 'derived' : 'unavailable',
        hasQueryEngineResource
          ? 'Derived from query-engine-core and resource.'
          : 'Requires query-engine-core and resource.'
      ),
      decision(
        FEATURE_IDS.queryPlan,
        hasQueryPlan,
        hasQueryPlan ? 'schema' : 'unavailable',
        hasQueryPlan
          ? 'Found the experimental Plan, Operator, and Port schema shape.'
          : 'The experimental Plan, Operator, and Port schema shape is absent.'
      ),
      decision(
        FEATURE_IDS.queryEngineDataFlow,
        false,
        'unavailable',
        'No schema capability represents the analyzer data-flow service.'
      ),
      decision(
        FEATURE_IDS.nvtx,
        false,
        'unavailable',
        'No schema capability represents the NVTX service.'
      ),
    ],
  };
}
