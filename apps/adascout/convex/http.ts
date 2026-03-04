import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { downloadReport, startAssetUpload } from "./httpActions";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  method: "POST",
  path: "/api/assets/upload/start",
  handler: startAssetUpload,
});

http.route({
  method: "GET",
  path: "/api/reports/export",
  handler: downloadReport,
});

export default http;
