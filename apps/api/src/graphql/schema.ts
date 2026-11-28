import "./types/common.ts";
import "./types/domain.ts";
import "./types/user.ts";
import "./types/auth.ts";
import "./types/catalog.ts";
import "./types/purchasing.ts";
import "./types/stock.ts";
import "./types/sales.ts";
import "./types/sync.ts";
import "./types/reports.ts";
import "./types/admin.ts";
import "./types/settings.ts";

import { applyOperationPolicies } from "../auth/operation-guard.ts";
import { builder } from "./builder.ts";

/**
 * The Pothos-authored schema. Operations land here slice by slice; everything
 * still missing must be listed in `pending-operations.ts`.
 */
const schema = builder.toSchema({ sortSchema: false });
applyOperationPolicies(schema);

export const appSchema = schema;
