import { defineApp } from "convex/server";
import workflow from "@convex-dev/workflow/convex.config";
import stagehand from "./stagehand/convex.config";

const app = defineApp();

app.use(workflow);
app.use(stagehand, { name: "stagehand" });

export default app;
