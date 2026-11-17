package com.voldev.voldev;

import java.nio.charset.StandardCharsets;

final class HtmlRewriter {

    static final String VOLCANO_TAG = "volcano-code";

    static final String RENDER_MARK = "volcano-ide";

    static final String STYLE_MARK = "id=\"voldev-theme\"";

    private static final String HEAD_END = "</head>";

    private static final byte[] TAG_BYTES = VOLCANO_TAG.getBytes(StandardCharsets.US_ASCII);
    private static final byte[] MARK_BYTES = RENDER_MARK.getBytes(StandardCharsets.US_ASCII);

    private HtmlRewriter() {
    }

    static String rewrite(String html, String styleTag) {
        if (html == null || !isVolcanoPage(html)) {
            return html;
        }
        var out = LegacyColorMigration.migrate(html);
        if (out.contains(STYLE_MARK)) {
            return out;
        }
        var headEnd = out.indexOf(HEAD_END);
        if (headEnd < 0) {
            return out;
        }
        return out.substring(0, headEnd) + styleTag + out.substring(headEnd);
    }

    static boolean mayContainVolcano(byte[] html) {
        return indexOf(html, TAG_BYTES) >= 0 || indexOf(html, MARK_BYTES) >= 0;
    }

    private static int indexOf(byte[] haystack, byte[] needle) {
        var last = haystack.length - needle.length;
        for (var i = 0; i <= last; i++) {
            if (haystack[i] != needle[0]) {
                continue;
            }
            var matched = true;
            for (var j = 1; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                return i;
            }
        }
        return -1;
    }

    private static boolean isVolcanoPage(String html) {
        return html.contains(VOLCANO_TAG) || html.contains(RENDER_MARK);
    }
}
