import SchemaBuilder from "@pothos/core";

import type { Role } from "../auth/permissions.ts";
import type { RequestContext } from "./context.ts";

export type SortDirection = "ASC" | "DESC";

export interface CommonSchemaTypes {
  Context: RequestContext;
  Scalars: {
    DateTime: {
      Input: Date | string;
      Output: Date | string;
    };
  };
  Objects: {
    PageInfo: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  Enums: {
    SortDirection: SortDirection;
    UserRole: Role;
  };
}

export const builder = new SchemaBuilder<CommonSchemaTypes>({});
