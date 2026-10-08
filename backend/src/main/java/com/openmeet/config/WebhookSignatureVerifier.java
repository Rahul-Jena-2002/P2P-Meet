/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.config;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Constant-time HMAC-SHA256 verifier for webhook signatures (Item 15).
 * Prevents timing attacks and rejects forged or unverified third-party notifications.
 */
public class WebhookSignatureVerifier {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    /**
     * Verifies that the provided hex signature matches the HMAC-SHA256 of the payload.
     * Uses MessageDigest.isEqual for constant-time comparison to prevent side-channel timing attacks.
     *
     * @param payloadRaw Raw webhook body as received in HTTP request
     * @param secret Shared secret known to the sender and recipient
     * @param signatureHex Expected signature header value (e.g. from X-Hub-Signature-256 or X-Signature)
     * @return true if signature is valid and authentic; false otherwise
     */
    public static boolean verifyHmacSha256(byte[] payloadRaw, String secret, String signatureHex) {
        if (payloadRaw == null || secret == null || signatureHex == null || signatureHex.isBlank()) {
            return false;
        }

        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
            mac.init(secretKey);
            byte[] computedHmac = mac.doFinal(payloadRaw);

            String cleanSig = signatureHex.startsWith("sha256=") ? signatureHex.substring(7) : signatureHex;
            byte[] expectedHmac = HexFormat.of().parseHex(cleanSig.trim());

            // Constant-time comparison
            return MessageDigest.isEqual(computedHmac, expectedHmac);
        } catch (Exception e) {
            return false;
        }
    }
}
