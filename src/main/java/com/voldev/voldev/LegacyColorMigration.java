package com.voldev.voldev;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 迁移历史文章里的「死色值」。
 *
 * <p>文章正文里的火山代码块是保存时生成的 HTML 快照。表格的背景、边框、文字
 * 早已改写成 {@code var(--vc-xxx, 兜底)}，换主题会跟着变；但语法高亮那一层
 * 早期版本是写死的 VS Code Dark+ 色值，例如：</p>
 *
 * <pre>{@code
 * 编辑框<span style="color:#b5cea8">3</span>.内容 = 私钥
 * 公钥 = sm2.<span style="color:#dcdcaa">取公钥</span> (私钥)
 * }</pre>
 *
 * <p>结果就是「表格颜色换了，可每个字的颜色永远一样」—— 数字永远浅绿、
 * 方法名永远米黄。这里在输出响应前把这些死色值改写成语义变量：</p>
 *
 * <pre>{@code
 * color:#b5cea8  →  color:var(--vc-num)
 * color:#dcdcaa  →  color:var(--vc-func)
 * }</pre>
 *
 * <p>历史文章不用重新保存，刷新页面就是当前主题的配色；新版渲染器产出的
 * {@code var()} 内容经过这里没有任何变化。</p>
 *
 * <p>匹配范围刻意收窄：只认「color: 后面直接跟 # 开头的六位色值」，
 * 因此 {@code var(--vc-num, #B5CEA8)} 里的兜底值、{@code border-color:} 之类
 * 的复合属性都不会被误改。</p>
 */
final class LegacyColorMigration {

    /** 死色值 → 对应变量。键是小写十六进制，值是 --vc-* 变量名。 */
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

    /**
     * 负向后视排除 {@code border-color:} / {@code scrollbar-color:} 这类复合属性，
     * 只匹配独立的 color 声明。
     */
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
