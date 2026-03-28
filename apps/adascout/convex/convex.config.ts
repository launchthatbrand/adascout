import { defineApp } from "convex/server";
import workflow from "@convex-dev/workflow/convex.config";
import launchthat_auth from "launchthat-plugin-auth/convex/component/convex.config";
import launchthat_browserlaunch from "launchthat-plugin-browserlaunch/convex/component/convex.config";
import stagehand from "./stagehand/convex.config";

const app = defineApp();

app.use(workflow);
app.use(launchthat_auth);
app.use(launchthat_browserlaunch);
app.use(stagehand, { name: "stagehand" });

export default app;
