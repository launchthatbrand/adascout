/* eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-argument
*/
import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

const componentsAny = components as any;

export const workflow = new WorkflowManager(componentsAny.workflow);
