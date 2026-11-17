package com.voldev.voldev;

final class HtmlRewriter {

    static final String VOLCANO_TAG = "volcano-code";

    static final String RENDER_MARK = "volcano-ide";

    static final String STYLE_MARK = "id=\"voldev-theme\"";

    private static final String HEAD_END = "</head>";

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

    private static boolean isVolcanoPage(String html) {
        return html.contains(VOLCANO_TAG) || html.contains(RENDER_MARK);
    }
}
