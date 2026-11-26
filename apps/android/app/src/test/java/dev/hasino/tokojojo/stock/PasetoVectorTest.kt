package dev.hasino.tokojojo.stock

import net.aholbrook.paseto.Purpose
import net.aholbrook.paseto.TokenService
import net.aholbrook.paseto.protocol.Version
import net.aholbrook.paseto.protocol.key.AsymmetricPublicKey
import net.aholbrook.paseto.protocol.key.AsymmetricSecretKey
import net.aholbrook.paseto.protocol.key.KeyPair
import net.aholbrook.paseto.token
import net.aholbrook.paseto.tokenService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class PasetoVectorTest {
    private fun verifyOnlyService(): TokenService =
        tokenService(
            version = Version.V4,
            purpose =
                Purpose.Public {
                    KeyPair(
                        secretKey = null,
                        publicKey = AsymmetricPublicKey.ofHex(PUBLIC_KEY, Version.V4),
                    )
                },
        ) {
            rules {
                issuedInPast = null
                notExpired = null
            }
        }

    @Test
    fun verifiesOfficialV4PublicVectors() {
        val service = verifyOnlyService()

        val first = service.decode(TOKEN_1)
        assertEquals("this is a signed message", first.claims["data"]?.stringOrNull)
        assertEquals(Instant.parse("2022-01-01T00:00:00Z"), first.expiresAt)

        val second = service.decode(TOKEN_2)
        assertEquals("this is a signed message", second.claims["data"]?.stringOrNull)

        val third = service.decode(TOKEN_3, implicitAssertion = IMPLICIT_3)
        assertEquals("this is a signed message", third.claims["data"]?.stringOrNull)
    }

    @Test
    fun signsAndVerifiesWithRawEd25519Keys() {
        val secretKey = AsymmetricSecretKey.ofHex(SECRET_KEY, Version.V4)
        val publicKey = AsymmetricPublicKey.ofHex(PUBLIC_KEY, Version.V4)
        val service =
            tokenService(
                version = Version.V4,
                purpose = Purpose.Public { KeyPair(secretKey, publicKey) },
            ) {
                rules {
                    issuedInPast = null
                    notExpired = null
                }
            }

        val issuedAt = Instant.parse("2026-01-01T00:00:00Z")
        val value =
            token {
                this.issuedAt = issuedAt
                expiresAt = issuedAt.plusSeconds(3600)
                claims { put("data", "this is a signed message") }
            }

        val encoded = service.encode(value)
        assertTrue(encoded.startsWith("v4.public."))
        val decoded = service.decode(encoded)
        assertEquals("this is a signed message", decoded.claims["data"]?.stringOrNull)
        assertEquals(64, publicKey.toHex().length)
    }

    private companion object {
        const val PUBLIC_KEY =
            "1eb9dbbbbc047c03fd70604e0071f0987e16b28b757225c11f00415d0e20b1a2"
        const val SECRET_KEY =
            "b4cbfb43df4ce210727d953e4a713307fa19bb7d9f85041438d9e11b942a3774" +
                "1eb9dbbbbc047c03fd70604e0071f0987e16b28b757225c11f00415d0e20b1a2"
        const val TOKEN_1 =
            "v4.public.eyJkYXRhIjoidGhpcyBpcyBhIHNpZ25lZCBtZXNzYWdlIiwiZXhwIjoiMjAyMi0wMS0wMVQwMDowMDowMCswMDowMCJ9" +
                "bg_XBBzds8lTZShVlwwKSgeKpLT3yukTw6JUz3W4h_ExsQV-P0V54zemZDcAxFaSeef1QlXEFtkqxT1ciiQEDA"
        const val TOKEN_2 =
            "v4.public.eyJkYXRhIjoidGhpcyBpcyBhIHNpZ25lZCBtZXNzYWdlIiwiZXhwIjoiMjAyMi0wMS0wMVQwMDowMDowMCswMDowMCJ9" +
                "v3Jt8mx_TdM2ceTGoqwrh4yDFn0XsHvvV_D0DtwQxVrJEBMl0F2caAdgnpKlt4p7xBnx1HcO-SPo8FPp214HDw" +
                ".eyJraWQiOiJ6VmhNaVBCUDlmUmYyc25FY1Q3Z0ZUaW9lQTlDT2NOeTlEZmdMMVc2MGhhTiJ9"
        const val TOKEN_3 =
            "v4.public.eyJkYXRhIjoidGhpcyBpcyBhIHNpZ25lZCBtZXNzYWdlIiwiZXhwIjoiMjAyMi0wMS0wMVQwMDowMDowMCswMDowMCJ9" +
                "NPWciuD3d0o5eXJXG5pJy-DiVEoyPYWs1YSTwWHNJq6DZD3je5gf-0M4JR9ipdUSJbIovzmBECeaWmaqcaP0DQ" +
                ".eyJraWQiOiJ6VmhNaVBCUDlmUmYyc25FY1Q3Z0ZUaW9lQTlDT2NOeTlEZmdMMVc2MGhhTiJ9"
        const val IMPLICIT_3 = "{\"test-vector\":\"4-S-3\"}"
    }
}
