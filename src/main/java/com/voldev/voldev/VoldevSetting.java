package com.voldev.voldev;

public class VoldevSetting {

    public static final String DEFAULT_THEME = "dark";

    private String theme;

    public String getTheme() {
        return theme == null || theme.isBlank() ? DEFAULT_THEME : theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }
}
