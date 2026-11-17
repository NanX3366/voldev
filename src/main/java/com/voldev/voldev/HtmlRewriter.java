package com.voldev.voldev;

/**
 * 改写页面 HTML：把配色样式插进 {@code <head>}，并把历史死色值换成语义变量。
 *
 * <p>从 {@link ThemeStyleFilter} 里剥出来的纯函数，不依赖 Spring / Reactor，
 * 只做字符串处理，方便单独验证边界情况。</p>
 *
 * <p>核心原则是**不动不含火山代码块的页面**：首页、归档、标签页、关于页、
 * 控制台等一个字节都不改，既不会误伤其它插件/主题里同样的色值，也省掉
 * 每请求一次的全量正则扫描。</p>
 */
final class HtmlRewriter {

    /** 火山代码块的自定义标签名，是「这页需不需要处理」的首个判据。 */
    static final String VOLCANO_TAG = "volcano-code";

    /**
     * 渲染结果的类名，作为第二判据。
     *
     * <p>只要页面里有代码块的渲染结果就一定命中：新快照是 {@code <volcano-code>} 包着
     * {@code <details class="volcano-ide">}，两者必具其一。多留这一条是为了万一将来
     * 自定义标签被上层过滤掉，样式仍能注入，不至于整站代码块掉回兜底色。</p>
     */
    static final String RENDER_MARK = "volcano-ide";

    /** 已注入过的标记，用于幂等：上层若有页面缓存，同一份 HTML 会重复经过这里。 */
    static final String STYLE_MARK = "id=\"voldev-theme\"";

    private static final String HEAD_END = "</head>";

    private HtmlRewriter() {
    }

    /**
     * 对一份 HTML 做实际改写。
     *
     * <p>不需要改动时**原样返回入参对象**，调用方用 {@code ==} 即可判断「零改动」，
     * 不必逐字符比较。</p>
     *
     * <p>插样式用 {@code indexOf} + 字符串拼接，而不是 {@code replaceFirst}：
     * 后者把入参当正则、把替换串当模板，将来若把设置值拼进样式里，一个 {@code $}
     * 就会抛异常或错位；而且它会替换掉所有 {@code </head>} 而不是第一处。</p>
     */
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

    /** 页面里是否有火山代码块的痕迹（自定义标签或渲染结果的类名）。 */
    private static boolean isVolcanoPage(String html) {
        return html.contains(VOLCANO_TAG) || html.contains(RENDER_MARK);
    }
}
