"use client";

import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";

export default function FindingDetailPage() {
  const params = useParams();
  const assetIdParam = params.assetId;
  const findingIdParam = params.findingId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;
  const findingId =
    typeof findingIdParam === "string"
      ? (findingIdParam as Id<"findings">)
      : undefined;

  const finding = useQuery(
    api.findings.getMyFinding,
    findingId ? { findingId } : "skip",
  );
  const asset = useQuery(api.assets.getMyAsset, assetId ? { assetId } : "skip");
  const updateFindingStatus = useMutation(api.findings.updateMyFindingStatus);
  const assignFinding = useMutation(api.findings.assignMyFinding);
  const actor = useQuery(api.findings.getMyFindingActor, {}) as
    | { userId: Id<"users"> }
    | undefined;

  if (finding === undefined) {
    return (
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <p className="text-sm">Loading finding...</p>
      </div>
    );
  }

  if (finding === null) {
    return (
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <p className="text-sm">Finding not found.</p>
        {assetId && (
          <Link
            href={`/admin/assets/${assetId}/findings`}
            className="mt-2 inline-block text-sm underline underline-offset-4"
          >
            Back to Findings
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/assets/${assetId}/findings`}
            className="text-sm underline underline-offset-4"
          >
            Back to Findings
          </Link>
        </div>
      </div>

      <div className="border-border/60 bg-background rounded-xl border p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                Finding
              </p>
              <h1 className="text-2xl font-semibold">{finding.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  finding.severity === "critical" ||
                  finding.severity === "serious"
                    ? "destructive"
                    : "outline"
                }
              >
                {finding.severity}
              </Badge>
              <Badge
                variant={
                  finding.status === "resolved" ||
                  finding.status === "verified_on_rescan"
                    ? "default"
                    : finding.status === "regressed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {finding.status}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Rule ID</p>
              <p className="font-medium">{finding.ruleId}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Source</p>
              <p className="font-medium">{finding.source}</p>
            </div>
            {finding.pageUrl && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Page URL</p>
                <a
                  href={finding.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium break-all underline underline-offset-4"
                >
                  {finding.pageUrl}
                </a>
              </div>
            )}
            {finding.target && (
              <div>
                <p className="text-muted-foreground">Target</p>
                <p className="font-medium">{finding.target}</p>
              </div>
            )}
            {finding.pageNumber && (
              <div>
                <p className="text-muted-foreground">Page Number</p>
                <p className="font-medium">{finding.pageNumber}</p>
              </div>
            )}
            {finding.confidence && (
              <div>
                <p className="text-muted-foreground">Confidence</p>
                <p className="font-medium">
                  {Math.round(finding.confidence * 100)}%
                </p>
              </div>
            )}
            {finding.assignee && (
              <div>
                <p className="text-muted-foreground">Assignee</p>
                <p className="font-medium">
                  {String(finding.assignee).slice(0, 12)}...
                </p>
              </div>
            )}
            {finding.dueAt && (
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium">
                  {new Date(finding.dueAt).toLocaleDateString()}
                </p>
              </div>
            )}
            {finding.evidenceHash && (
              <div>
                <p className="text-muted-foreground">Evidence Hash</p>
                <p className="font-mono text-xs">{finding.evidenceHash}</p>
              </div>
            )}
          </div>

          {finding.description && (
            <div>
              <p className="text-muted-foreground text-sm">Description</p>
              <p className="mt-1">{finding.description}</p>
            </div>
          )}

          {finding.helpUrl && (
            <div>
              <p className="text-muted-foreground text-sm">Help</p>
              <a
                href={finding.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm underline underline-offset-4"
              >
                Learn more about {finding.ruleId}
              </a>
            </div>
          )}

          {finding.codeSnippet && (
            <div>
              <p className="text-muted-foreground text-sm">Code Snippet</p>
              <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-xs">
                <code>{finding.codeSnippet}</code>
              </pre>
            </div>
          )}

          {finding.domSnippet && (
            <div>
              <p className="text-muted-foreground text-sm">DOM Snippet</p>
              <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-xs">
                <code>{finding.domSnippet}</code>
              </pre>
            </div>
          )}

          {finding.resolutionNotes && (
            <div>
              <p className="text-muted-foreground text-sm">Resolution Notes</p>
              <p className="mt-1">{finding.resolutionNotes}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() =>
                void updateFindingStatus({
                  findingId: finding._id,
                  status: "in_progress",
                })
              }
            >
              Start Working
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void updateFindingStatus({
                  findingId: finding._id,
                  status: "resolved",
                })
              }
            >
              Mark Resolved
            </Button>
            {actor?.userId && (
              <Button
                variant="secondary"
                onClick={() =>
                  void assignFinding({
                    findingId: finding._id,
                    assignee: actor.userId,
                  })
                }
              >
                Assign to Me
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
