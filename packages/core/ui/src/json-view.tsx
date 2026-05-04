"use client";

import React from "react";

export interface JSONViewProps {
  data: unknown;
  className?: string;
}

export function JSONView({ data, className = "" }: JSONViewProps) {
  const formattedJson = JSON.stringify(data, null, 2);

  return (
    <pre className={`bg-muted overflow-auto rounded p-3 text-sm ${className}`}>
      <code>{formattedJson}</code>
    </pre>
  );
}
