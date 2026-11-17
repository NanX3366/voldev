package com.voldev.voldev;

import java.nio.charset.StandardCharsets;
import org.reactivestreams.Publisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferLimitException;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.http.server.reactive.ServerHttpResponseDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.ReactiveSettingFetcher;
import run.halo.app.security.AdditionalWebFilter;

/**
 * 把当前配色主题注入到页面 {@code <head>}。
 *
 * <p>文章正文里的火山代码块是保存时生成 HTML 快照，配色在快照里只写
 * {@code var(--vc-xxx, 兜底色)}，不写具体色值。因此换主题时只要改这里的注入内容，
 * 已发布文章无需重新保存即可换色。</p>
 */
@Component
public class ThemeStyleFilter implements AdditionalWebFilter {

    private static final Logger log = LoggerFactory.getLogger(ThemeStyleFilter.class);

    /** 与 setting.yaml 里的 group 对应。 */
    private static final String GROUP = "theme";

    /**
     * 单个 HTML 响应的缓冲上限。
     *
     * <p>改写需要把整页读进内存，正常情况下文章页/归档页只有几十到几百 KB，
     * 这个上限纯属保险：超过它说明响应本身已经异常，宁可放弃注入也不能让堆无限膨胀。</p>
     */
    private static final int MAX_HTML_BYTES = 32 * 1024 * 1024;

    /**
     * 代码块外壳样式（折叠动画 + 标题栏修正）。
     *
     * <p>历史文章的 HTML 快照是保存时固化的，快照自带的样式里没有这段规则，
     * 所以除了新保存的文章各带一份之外，这里再注入一份，让老文章也能平滑展开。</p>
     *
     * <p>原理：{@code interpolate-size: allow-keywords} 让 {@code block-size:auto}
     * 可以参与过渡（否则 auto 不可插值，只能瞬切），配合 Chrome 的
     * {@code ::details-content} 伪元素才能对折叠内容做高度动画；
     * {@code content-visibility} 带 {@code allow-discrete} 是为了让内容在收起时
     * 留到高度归零之后才真正隐藏，否则一收起内容就先没了。</p>
     *
     * <p>不支持这两个特性的浏览器会整块忽略这些声明，退回原来的瞬间切换，
     * 不会比现在更差，因此不需要额外的能力检测或降级分支。</p>
     *
     * <p>后半段是给历史快照做减法。旧快照的标题栏右侧挂了一个折叠箭头，与主题给
     * summary 的左侧指示重复，直接隐藏掉。</p>
     *
     * <p>标题栏与正文之间那条「虚线」不是插件画的，而是主题给 {@code summary::after}
     * 一类伪元素挂了 {@code border-bottom}：在普通块级 summary 里它是分隔线，
     * 但我们的 summary 是 flex 容器，伪元素变成 flex item，那条边框就贴着标题栏底边
     * 横贯一条线。所以把 summary 四边、{@code ::after} 的下边框、正文容器的上边框
     * 统统清零；特意不动 {@code ::before}，那是主题画左侧折叠箭头的地方。
     * 选择器里把类名写两遍，是为了把特异性抬到 (0,2,x)，压过主题常见的
     * {@code .content details summary} 这类规则。</p>
     *
     * <p>最后三条是行号：用 CSS 计数器编号，HTML 结构不动，因此旧快照也能直接显示。
     * 行号画在 {@code .vc-body} 的左侧留白里（容器加 {@code padding-left}），
     * 代码缩进照旧由 {@code .vc-line} 自身的内联 {@code padding-left} 决定；
     * 正文容器的 padding 在内联样式里，必须 {@code !important} 才压得住。
     * 颜色取 {@code --vc-text} 再降透明度，10 套主题都能自适应，不必新增变量。</p>
     */
    private static final String SHELL_STYLE = """
        <style id="voldev-shell">
        details.volcano-ide{interpolate-size:allow-keywords}
        details.volcano-ide::details-content{block-size:0;overflow:hidden;transition-property:block-size,content-visibility;transition-duration:.35s;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-behavior:allow-discrete}
        details.volcano-ide[open]::details-content{block-size:auto}
        @media (prefers-reduced-motion:reduce){details.volcano-ide::details-content{transition:none}}
        html body details.volcano-ide.volcano-ide>summary{border:0 !important;box-shadow:none !important}
        html body details.volcano-ide.volcano-ide>summary::after{border-bottom:0 !important;border-block-end:0 !important}
        html body details.volcano-ide.volcano-ide>.vc-body{border-top:0 !important;border-block-start:0 !important}
        details.volcano-ide>summary .vc-chev{display:none !important}
        html body details.volcano-ide .vc-body{padding-left:38px !important;counter-reset:vc-ln;position:relative}
        html body details.volcano-ide .vc-body .vc-line{counter-increment:vc-ln;position:relative}
        html body details.volcano-ide .vc-body .vc-line::before{content:counter(vc-ln);position:absolute;left:var(--vc-lno,-38px);top:1px;width:38px;padding-right:4px;box-sizing:border-box;text-align:right;color:var(--vc-text,#D4D4D4);opacity:.45;line-height:1.75;font-variant-numeric:tabular-nums;user-select:none;-webkit-user-select:none;pointer-events:none}
        html body details.volcano-ide .vc-body>div:not(.vc-line):not(.vc-sec),html body details.volcano-ide .vc-body>table{position:static !important}
        html body details.volcano-ide .vc-body tbody>tr>td:first-child{counter-increment:vc-ln}
        html body details.volcano-ide .vc-body tbody>tr>td:first-child::before{content:counter(vc-ln);position:absolute;left:var(--vc-tdnum,0px);width:38px;padding-right:4px;box-sizing:border-box;text-align:right;color:var(--vc-text,#D4D4D4);opacity:.45;line-height:1.75;font-variant-numeric:tabular-nums;user-select:none;-webkit-user-select:none;pointer-events:none}
        </style>
        """;

    private final ReactiveSettingFetcher settingFetcher;

    public ThemeStyleFilter(ReactiveSettingFetcher settingFetcher) {
        this.settingFetcher = settingFetcher;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        var request = exchange.getRequest();
        // 只处理页面 GET；API 一律不碰（JSON 也不是 text/html）
        if (!HttpMethod.GET.equals(request.getMethod())) {
            return chain.filter(exchange);
        }
        var path = request.getPath().value();
        // 后台控制台页面里不可能有火山代码块（编辑器里是 textarea，不是渲染后的快照），
        // 放行可以省掉整页缓冲 + UTF-8 解码 + 关键字扫描，打开编辑器的首屏更快。
        if (path.startsWith("/apis") || path.startsWith("/console")) {
            return chain.filter(exchange);
        }
        return settingFetcher.fetch(GROUP, VoldevSetting.class)
            .map(VoldevSetting::getTheme)
            .defaultIfEmpty(VoldevSetting.DEFAULT_THEME)
            .map(ThemePalette::of)
            .flatMap(palette -> {
                log.debug("voldev: inject theme [{}] for {}", palette.getId(), request.getPath());
                return chain.filter(exchange.mutate()
                    .response(new InjectingResponse(
                        exchange.getResponse(), palette.toStyleTag() + SHELL_STYLE))
                    .build());
            });
    }

    /** 把 style 片段塞进 HTML 的 {@code </head>} 之前。 */
    private static final class InjectingResponse extends ServerHttpResponseDecorator {

        private final String styleTag;

        InjectingResponse(ServerHttpResponse delegate, String styleTag) {
            super(delegate);
            this.styleTag = styleTag;
        }

        /**
         * 判断这条响应是不是（明文）HTML。
         *
         * <p>注意**不能**用 Content-Encoding 判断：Halo 默认开着
         * {@code server.compression.enabled}，压缩是在更外层做的，我们这一层拿到的
         * body 仍是明文，响应头里却已经带了 {@code Content-Encoding: gzip}；按它跳过
         * 会导致永远注入不上去。</p>
         *
         * <p>只看 {@code Content-Type}：明确是 text/html 才动手。不能因为「没有
         * Content-Type」就猜着试——那会把二进制响应（图片、字体、附件）也拖进来
         * 做一次 UTF-8 解码，属于白烧 CPU 还可能损坏数据。</p>
         *
         * <p>头部已经带了超限的 {@code Content-Length} 时直接放行，连缓冲都不做。</p>
         */
        private boolean isHtmlBody() {
            var headers = getDelegate().getHeaders();
            var contentType = headers.getContentType();
            if (contentType == null || !MediaType.TEXT_HTML.isCompatibleWith(contentType)) {
                return false;
            }
            var length = headers.getContentLength();
            if (length > MAX_HTML_BYTES) {
                log.debug("voldev: 响应 {} 字节超过上限，跳过注入", length);
                return false;
            }
            return true;
        }

        @Override
        public Mono<Void> writeWith(Publisher<? extends DataBuffer> body) {
            if (!isHtmlBody()) {
                return super.writeWith(body);
            }
            return DataBufferUtils.join(body, MAX_HTML_BYTES)
                .flatMap(this::injectAndWrite)
                // body 为空时 join 会给空 Mono，直接结束响应，否则调用方会一直是 pending
                .switchIfEmpty(Mono.defer(() -> super.setComplete()))
                // 缓冲超限的解释器已经释放了已收的数据，只能放弃改写、正常收尾
                .onErrorResume(DataBufferLimitException.class, e -> {
                    log.warn("voldev: 单个响应超过 {} 字节，放弃样式注入", MAX_HTML_BYTES);
                    return super.setComplete();
                });
        }

        /**
         * Spring 6 渲染模板时可能走分块写出，只覆盖 writeWith 会漏掉这条路径，
         * 页面就完全看不到注入。这里把分块流拼起来当整体处理。
         */
        @Override
        public Mono<Void> writeAndFlushWith(
            Publisher<? extends Publisher<? extends DataBuffer>> body) {
            if (!isHtmlBody()) {
                return super.writeAndFlushWith(body);
            }
            return writeWith(Flux.from(body).flatMap(inner -> Flux.from(inner)));
        }

        private Mono<Void> injectAndWrite(DataBuffer buffer) {
            try {
                var bytes = new byte[buffer.readableByteCount()];
                buffer.read(bytes);
                var html = new String(bytes, StandardCharsets.UTF_8);
                var rewritten = HtmlRewriter.rewrite(html, styleTag);
                // 同一个对象 = 一个字节都没改（不含火山代码块），原样输出省一次编码
                if (rewritten == html) {
                    log.debug("voldev: 页面不含火山代码块，跳过注入");
                    return super.writeWith(Mono.just(bufferFactory().wrap(bytes)));
                }
                var out = rewritten.getBytes(StandardCharsets.UTF_8);
                var headers = getDelegate().getHeaders();
                headers.setContentLength(out.length);
                // 改过响应体之后原来的 ETag 已失效，留着会让浏览器拿到 304 继续用旧页面。
                headers.remove(HttpHeaders.ETAG);
                log.debug("voldev: 注入完成，{} -> {} bytes", bytes.length, out.length);
                return super.writeWith(Mono.just(bufferFactory().wrap(out)));
            } finally {
                DataBufferUtils.release(buffer);
            }
        }
    }
}
