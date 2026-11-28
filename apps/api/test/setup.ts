import { generateKeyPairSync } from "node:crypto";

process.env.APP_ENV = "test";

if (!process.env.PASSWORD_PEPPER) {
  process.env.PASSWORD_PEPPER = "test-only-password-pepper";
}
process.env.PASSWORD_PEPPER_VERSION ??= "1";

if (!process.env.PASETO_ACTIVE_PRIVATE_KEY) {
  const pair = generateKeyPairSync("ed25519");
  const privateKey = pair.privateKey.export({ format: "jwk" }) as {
    d?: string;
  };
  const publicKey = pair.publicKey.export({ format: "jwk" }) as {
    x?: string;
  };
  if (!privateKey.d || !publicKey.x) {
    throw new Error("Could not generate test PASETO keys.");
  }
  process.env.PASETO_ACTIVE_PRIVATE_KEY = privateKey.d;
  process.env.PASETO_ACTIVE_PUBLIC_KEY = publicKey.x;
  process.env.PASETO_ACTIVE_KID = "test-v1";
}
