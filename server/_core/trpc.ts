import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getProfileByUserId, isProfileActive } from "../staff-service";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireActiveStaff = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const staff = await getProfileByUserId(ctx.user.id);
  if (!staff || !isProfileActive(staff)) throw new TRPCError({ code: "FORBIDDEN", message: "حسابك غير نشط أو ليس ضمن أفراد الصيدلية." });
  return next({ ctx: { ...ctx, staff } });
});

export const staffProcedure = protectedProcedure.use(requireActiveStaff);

export const staffAdminProcedure = staffProcedure.use(t.middleware(async (opts) => {
  if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const staff = await getProfileByUserId(opts.ctx.user.id);
  if (!staff || !staff.permissions.includes("staff.manage")) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إدارة أفراد الصيدلية." });
  return opts.next({ ctx: opts.ctx });
}));

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
