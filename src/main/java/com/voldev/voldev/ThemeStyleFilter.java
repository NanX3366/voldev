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

@Component
public class ThemeStyleFilter implements AdditionalWebFilter {

    private static final Logger log = LoggerFactory.getLogger(ThemeStyleFilter.class);

    private static final String GROUP = "theme";

    private static final int MAX_HTML_BYTES = 32 * 1024 * 1024;

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

        if (!HttpMethod.GET.equals(request.getMethod())) {
            return chain.filter(exchange);
        }
        var path = request.getPath().value();

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

    private static final class InjectingResponse extends ServerHttpResponseDecorator {

        private final String styleTag;

        InjectingResponse(ServerHttpResponse delegate, String styleTag) {
            super(delegate);
            this.styleTag = styleTag;
        }

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

                .switchIfEmpty(Mono.defer(() -> super.setComplete()))

                .onErrorResume(DataBufferLimitException.class, e -> {
                    log.warn("voldev: 单个响应超过 {} 字节，放弃样式注入", MAX_HTML_BYTES);
                    return super.setComplete();
                });
        }

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

                if (rewritten == html) {
                    log.debug("voldev: 页面不含火山代码块，跳过注入");
                    return super.writeWith(Mono.just(bufferFactory().wrap(bytes)));
                }
                var out = rewritten.getBytes(StandardCharsets.UTF_8);
                var headers = getDelegate().getHeaders();
                headers.setContentLength(out.length);

                headers.remove(HttpHeaders.ETAG);
                log.debug("voldev: 注入完成，{} -> {} bytes", bytes.length, out.length);
                return super.writeWith(Mono.just(bufferFactory().wrap(out)));
            } finally {
                DataBufferUtils.release(buffer);
            }
        }
    }
}
