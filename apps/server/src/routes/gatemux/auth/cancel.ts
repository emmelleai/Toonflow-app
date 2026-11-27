import { Router } from "express";
import { z } from "zod";
import u from "@/utils";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";

export default Router().post("/", validateFields({ flowId: z.uuid() }), (req, res) => {
  u.mcpControl.assertAppRequest(req);
  u.gatemuxAuth.assertEnabled();
  u.gatemuxAuth.cancelAuthorization(req.body.flowId);
  res.json(success(null));
});
