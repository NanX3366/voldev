package com.voldev.voldev;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class LegacyColorMigration {

    private static final Map<String, String> VARS = Map.ofEntries(
        Map.entry("b5cea8", "--vc-num"),
        Map.entry("dcdcaa", "--vc-func"),
        Map.entry("569cd6", "--vc-accent"),
        Map.entry("ce9178", "--vc-value"),
        Map.entry("6a9955", "--vc-remark"),
        Map.entry("4ec9b0", "--vc-type"),
        Map.entry("9cdcfe", "--vc-name"),
        Map.entry("ffd700", "--vc-paren"),
        Map.entry("da70d6", "--vc-bracket"),
        Map.entry("179fff", "--vc-brace"),
        Map.entry("d4d4d4", "--vc-text"),
        Map.entry("c8c8c8", "--vc-head"),
        Map.entry("89d185", "--vc-head-key"),
        Map.entry("d16969", "--vc-guide")
    );

    private static final Pattern DEAD_COLOR =
        Pattern.compile("(?<![-\\w])color:\\s*#([0-9a-fA-F]{6})");

    private LegacyColorMigration() {
    }

    static String migrate(String html) {
        if (html == null || html.indexOf('#') < 0) {
            return html;
        }
        Matcher matcher = DEAD_COLOR.matcher(html);
        StringBuilder out = new StringBuilder(html.length());
        boolean changed = false;
        while (matcher.find()) {
            String variable = VARS.get(matcher.group(1).toLowerCase(Locale.ROOT));
            if (variable == null) {
                matcher.appendReplacement(out, Matcher.quoteReplacement(matcher.group()));
            } else {
                matcher.appendReplacement(out, "color:var(" + variable + ")");
                changed = true;
            }
        }
        if (!changed) {
            return html;
        }
        matcher.appendTail(out);
        return out.toString();
    }
}
