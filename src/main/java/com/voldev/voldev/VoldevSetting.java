package com.voldev.voldev;

/**
 * 插件设置：目前只有配色主题一项。
 * 字段名必须和 {@code extensions/setting.yaml} 里 formSchema 的 name 一致，
 * Halo 通过 {@code ReactiveSettingFetcher.fetch("theme", VoldevSetting.class)} 反序列化。
 */
public class VoldevSetting {

    /** 默认「火山配色」，和前端 render.ts 里 var() 的兜底色保持一致。 */
    public static final String DEFAULT_THEME = "dark";

    private String theme;

    public String getTheme() {
        return theme == null || theme.isBlank() ? DEFAULT_THEME : theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }
}
