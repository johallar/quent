// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

interface DeepLinkErrorListProps {
  messages: readonly string[];
}

export function DeepLinkErrorList({ messages }: DeepLinkErrorListProps) {
  if (messages.length === 1) {
    return messages[0];
  }

  return (
    <span className="space-y-1">
      {messages.map((message, index) => (
        <span key={`${index}-${message}`} className="block">
          <span aria-hidden="true">• </span>
          {message}
        </span>
      ))}
    </span>
  );
}
