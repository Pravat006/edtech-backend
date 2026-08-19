import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { validateRequest } from "@/middlewares/validateRequest";
import {
    UpdateAddressSchema,
    UpdatePersonalDetailsSchema,
    UpdateEducationDetailsSchema,
} from "./profile.schema";
import * as profileController from "./profile.controller";

const router = Router();

router.use(authenticateUser);

router.get("/address", profileController.getAddress);
router.patch(
    "/address",
    validateRequest(UpdateAddressSchema),
    profileController.updateAddress
);

router.get("/personal", profileController.getPersonalDetails);
router.patch(
    "/personal",
    validateRequest(UpdatePersonalDetailsSchema),
    profileController.updatePersonalDetails
);

router.get("/education", profileController.getEducationDetails);
router.patch(
    "/education",
    validateRequest(UpdateEducationDetailsSchema),
    profileController.updateEducationDetails
);

export default router;
