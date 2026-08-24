import { Router } from "express";
import { getPublicPages, getPublicPageBySlug } from "./cms.controller";

const router = Router();

router.get("/pages", getPublicPages);
router.get("/pages/:slug", getPublicPageBySlug);

export default router;
