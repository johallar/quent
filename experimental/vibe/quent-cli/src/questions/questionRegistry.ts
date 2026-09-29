// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { longestResourceUsersQuestion } from './longestResourceUsers';
import { registerQuestion, type RegisteredQuestion } from './question.types';

const definitions = [longestResourceUsersQuestion] as const;

export const questionRegistry: ReadonlyMap<string, RegisteredQuestion> = new Map(
  definitions.map(definition => {
    const question = registerQuestion(definition);
    return [question.metadata.id, question];
  })
);

export function getQuestion(questionId: string): RegisteredQuestion {
  const question = questionRegistry.get(questionId);
  if (!question) {
    const supported = [...questionRegistry.keys()].join(', ');
    throw new Error(`Unknown question "${questionId}". Supported questions: ${supported}.`);
  }
  return question;
}
