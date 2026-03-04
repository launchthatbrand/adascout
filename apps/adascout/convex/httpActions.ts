import { ConvexError } from "convex/values";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const parseReportExportParams = (request: Request) => {
  const url = new URL(request.url);
  const reportId = url.searchParams.get("reportId");
  const formatParam = url.searchParams.get("format");
  const format = formatParam === "json" ? "json" : "markdown";
  if (!reportId) {
    throw new ConvexError("reportId is required.");
  }
  return { reportId, format } as {
    reportId: string;
    format: "json" | "markdown";
  };
};

export const startAssetUpload = httpAction(async (ctx) => {
  const uploadUrl = await ctx.runMutation(api.assets.generateAssetUploadUrl, {});
  return Response.json({ ok: true, uploadUrl }, { status: 200 });
});

export const downloadReport = httpAction(async (ctx, request) => {
  const { reportId, format } = parseReportExportParams(request);
  const payload = await ctx.runQuery(api.reports.getMyReportExport, {
    reportId: reportId as Id<"reports">,
    format,
  });
  return new Response(payload.body, {
    status: 200,
    headers: {
      "content-type": payload.contentType,
      "content-disposition": `attachment; filename="${payload.filename}"`,
      "cache-control": "no-store",
    },
  });
});

