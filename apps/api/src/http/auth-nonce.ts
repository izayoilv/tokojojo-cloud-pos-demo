import type { RequestHandler } from "express";
import { GraphQLError } from "graphql";

import { issueAuthNonce } from "../auth/devices.ts";
import type { AuthServices } from "../auth/services.ts";
import { isErrorCode } from "../graphql/errors.ts";
import { resolveClientIp } from "./client-ip.ts";
import { HttpError } from "./errors.ts";

function nonceHttpError(error: unknown): unknown {
  if (!(error instanceof GraphQLError)) return error;

  const code = error.extensions?.code;
  if (!isErrorCode(code)) return error;

  const status =
    code === "DEVICE_REVOKED"
      ? 403
      : code === "NOT_FOUND"
        ? 404
        : code === "INVALID_SIGNATURE"
          ? 401
          : 400;

  return new HttpError(status, code, error.message);
}

export function createNonceHandler(
  auth: AuthServices,
  options: { trustedProxies?: readonly string[] } = {},
): RequestHandler {
  return async (request, response, next) => {
    try {
      const deviceId = request.get("x-device-id");
      const keyId = request.get("x-device-key-id");
      if (!deviceId || !keyId) {
        throw new HttpError(
          400,
          "VALIDATION_FAILED",
          "X-Device-Id dan X-Device-Key-Id wajib diisi.",
        );
      }

      const ip = resolveClientIp({
        peerAddress: request.socket.remoteAddress,
        headers: request.headers,
        trustedProxies: options.trustedProxies,
      });
      if (!auth.nonceRateLimit.checkIp(ip)) {
        throw new HttpError(
          429,
          "RATE_LIMITED",
          "Terlalu banyak permintaan nonce. Coba lagi nanti.",
        );
      }
      auth.nonceRateLimit.recordIpFailure(ip);

      const issued = await issueAuthNonce({
        deviceId,
        keyId,
        now: auth.now(),
      });
      if (!auth.nonceRateLimit.checkDevice(deviceId)) {
        throw new HttpError(
          429,
          "RATE_LIMITED",
          "Terlalu banyak permintaan nonce. Coba lagi nanti.",
        );
      }
      auth.nonceRateLimit.recordDeviceFailure(deviceId);

      response.setHeader("Cache-Control", "no-store");
      response.status(200).json({
        nonce: issued.nonce,
        serverTime: issued.serverTime.toISOString(),
        expiresAt: issued.expiresAt.toISOString(),
      });
    } catch (error) {
      next(nonceHttpError(error));
    }
  };
}
