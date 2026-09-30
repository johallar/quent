// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allowedWorkspaceDependencies,
  knownPackages,
  requiredPackageSkeletons,
} from './dependency-policy.mjs';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = path.join(uiRoot, 'packages', '@quent');
const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

function packageShortName(packageName) {
  return packageName.replace(/^@quent\//, '');
}

function validateExports(packageName, exportsField, errors) {
  if (!exportsField) {
    errors.push(`${packageName}: missing exports map`);
    return;
  }
  if (typeof exportsField === 'string') {
    return;
  }
  for (const exportPath of Object.keys(exportsField)) {
    if (exportPath.includes('/src') || exportPath.includes('*')) {
      errors.push(`${packageName}: export "${exportPath}" exposes a private path`);
    }
  }
}

function findCycle(graph) {
  const visited = new Set();
  const visiting = new Set();
  const stack = [];

  function visit(packageName) {
    if (visiting.has(packageName)) {
      return [...stack.slice(stack.indexOf(packageName)), packageName];
    }
    if (visited.has(packageName)) {
      return undefined;
    }

    visiting.add(packageName);
    stack.push(packageName);
    for (const dependency of graph.get(packageName) ?? []) {
      const cycle = visit(dependency);
      if (cycle) {
        return cycle;
      }
    }
    stack.pop();
    visiting.delete(packageName);
    visited.add(packageName);
    return undefined;
  }

  for (const packageName of graph.keys()) {
    const cycle = visit(packageName);
    if (cycle) {
      return cycle;
    }
  }
  return undefined;
}

const packageDirectories = await readdir(packagesRoot, { withFileTypes: true });
const manifests = new Map();
const errors = [];

for (const directory of packageDirectories) {
  if (!directory.isDirectory()) {
    continue;
  }
  const manifestPath = path.join(packagesRoot, directory.name, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      continue;
    }
    throw error;
  }

  const expectedName = `@quent/${directory.name}`;
  if (manifest.name !== expectedName) {
    errors.push(`${manifestPath}: expected package name "${expectedName}"`);
  }
  if (!knownPackages.includes(directory.name)) {
    errors.push(`${manifestPath}: package is not declared in the dependency policy`);
  }
  manifests.set(directory.name, manifest);
  validateExports(manifest.name, manifest.exports, errors);
}

for (const packageName of knownPackages) {
  if (!(packageName in allowedWorkspaceDependencies)) {
    errors.push(`Missing dependency policy for @quent/${packageName}`);
  }
  for (const dependency of allowedWorkspaceDependencies[packageName] ?? []) {
    if (!knownPackages.includes(dependency) && dependency !== 'schema') {
      errors.push(`@quent/${packageName}: policy allows unknown package @quent/${dependency}`);
    }
  }
}

for (const packageName of requiredPackageSkeletons) {
  if (!manifests.has(packageName)) {
    errors.push(`Missing package skeleton @quent/${packageName}`);
  }
}

const graph = new Map([...manifests.keys()].map(packageName => [packageName, []]));
for (const [packageName, manifest] of manifests) {
  const seenDependencies = new Set();
  for (const section of dependencySections) {
    for (const [dependencyName, version] of Object.entries(manifest[section] ?? {})) {
      if (!dependencyName.startsWith('@quent/')) {
        continue;
      }
      if (seenDependencies.has(dependencyName)) {
        errors.push(
          `${manifest.name}: "${dependencyName}" appears in multiple dependency sections`
        );
        continue;
      }
      seenDependencies.add(dependencyName);

      const dependency = packageShortName(dependencyName);
      const isWorkspacePackage = manifests.has(dependency);
      if (isWorkspacePackage && version !== 'workspace:*') {
        errors.push(`${manifest.name}: "${dependencyName}" must use "workspace:*"`);
      }
      if (!knownPackages.includes(dependency) && dependency !== 'schema') {
        errors.push(`${manifest.name}: unknown Quent package "${dependencyName}"`);
        continue;
      }
      if (!(allowedWorkspaceDependencies[packageName] ?? []).includes(dependency)) {
        errors.push(`${manifest.name}: dependency on "${dependencyName}" is not allowed`);
      }
      if (isWorkspacePackage) {
        graph.get(packageName).push(dependency);
      }
    }
  }
}

const cycle = findCycle(graph);
if (cycle) {
  errors.push(`Workspace dependency cycle: ${cycle.join(' -> ')}`);
}

if (errors.length > 0) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${manifests.size} @quent package manifests.`);
}
