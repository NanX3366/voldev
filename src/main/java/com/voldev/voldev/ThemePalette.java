package com.voldev.voldev;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

public enum ThemePalette {

    DARK("dark", new String[] {

        "#1E1E1E", "#333333", "#555555", "#4A4A4A", "#D4D4D4",

        "#C8C8C8", "#89D185", "#9CDCFE", "#4EC9B0", "#CE9178",

        "#4EC9B0", "#6A9955", "#569CD6", "#D16969", "#1E1E1E",

        "#424242", "#5A5A5A", "#DCDCAA", "#B5CEA8", "#CE9178",

        "#C8C8C8", "#CE9178", "#4EC9B0", "#FFD700", "#DA70D6",

        "#179FFF", "#D4D4D4", "#D4D4D4", "#D4D4D4", "#569CD6",

        "#9CDCFE", "#3A2A2A", "#24363A", "#2A2A3A", "#243A2A"
    }),

    LIGHT("light", new String[] {
        "#FFFFFF", "#F3F3F3", "#C8C8C8", "#D4D4D4", "#1F1F1F",
        "#616161", "#1A7F37", "#001080", "#267F99", "#A31515",
        "#267F99", "#008000", "#0000FF", "#CD3131", "#F3F3F3",
        "#C1C1C1", "#A8A8A8", "#795E26", "#098658", "#A31515",
        "#1F1F1F", "#A31515", "#267F99", "#0431FA", "#7A3E9D",
        "#319331", "#1F1F1F", "#1F1F1F", "#1F1F1F", "#0000FF",
        "#001080", "#FBEAEA", "#E8F4F4", "#EAEAFB", "#E8F4E8"
    }),

    MONOKAI("monokai", new String[] {
        "#272822", "#4A4839", "#6B6A5C", "#5C5B4E", "#F8F8F2",
        "#CFCFC2", "#A6E22E", "#A6E22E", "#66D9EF", "#E6DB74",
        "#66D9EF", "#75715E", "#F92672", "#F92672", "#1E1F1C",
        "#4E4E43", "#5E5D52", "#A6E22E", "#AE81FF", "#E6DB74",
        "#F8F8F2", "#E6DB74", "#66D9EF", "#F8F8F2", "#A6E22E",
        "#66D9EF", "#F8F8F2", "#F8F8F2", "#F8F8F2", "#AE81FF",
        "#F8F8F2", "#4A3130", "#2F4444", "#33314A", "#2F4433"
    }),

    DRACULA("dracula", new String[] {
        "#282A36", "#3D4056", "#6B7090", "#5A5E75", "#F8F8F2",
        "#BFBFD0", "#50FA7B", "#8BE9FD", "#8BE9FD", "#F1FA8C",
        "#50FA7B", "#6272A4", "#FF79C6", "#FF79C6", "#21222C",
        "#4A4D5E", "#5A5E73", "#50FA7B", "#BD93F9", "#F1FA8C",
        "#F8F8F2", "#F1FA8C", "#8BE9FD", "#FF79C6", "#BD93F9",
        "#50FA7B", "#F8F8F2", "#F8F8F2", "#F8F8F2", "#BD93F9",
        "#8BE9FD", "#4A3038", "#2F444A", "#33314A", "#2F4440"
    }),

    ONE_DARK("one-dark", new String[] {
        "#282C34", "#333842", "#4B5263", "#3E4451", "#ABB2BF",
        "#C8CCD4", "#98C379", "#61AFEF", "#E5C07B", "#98C379",
        "#56B6C2", "#7F848E", "#61AFEF", "#E06C75", "#282C34",
        "#4B5263", "#5C6370", "#61AFEF", "#D19A66", "#56B6C2",
        "#D19A66", "#98C379", "#56B6C2", "#ABB2BF", "#E5C07B",
        "#C678DD", "#ABB2BF", "#ABB2BF", "#56B6C2", "#C678DD",
        "#E5C07B", "#3A2F33", "#2E3A3A", "#2F2F3E", "#33372E"
    }),

    NORD("nord", new String[] {
        "#2E3440", "#3B4252", "#4C566A", "#434C5E", "#D8DEE9",
        "#E5E9F0", "#A3BE8C", "#8FBCBB", "#8FBCBB", "#A3BE8C",
        "#88C0D0", "#616E88", "#81A1C1", "#BF616A", "#2E3440",
        "#4C566A", "#5E81AC", "#88C0D0", "#B48EAD", "#88C0D0",
        "#D8DEE9", "#A3BE8C", "#88C0D0", "#D8DEE9", "#EBCB8B",
        "#B48EAD", "#D8DEE9", "#D8DEE9", "#81A1C1", "#81A1C1",
        "#EBCB8B", "#3B3240", "#2F3B42", "#333347", "#2F3A31"
    }),

    GITHUB_DARK("github-dark", new String[] {
        "#0D1117", "#161B22", "#30363D", "#21262D", "#C9D1D9",
        "#E6EDF3", "#7EE787", "#79C0FF", "#FFA657", "#A5D6FF",
        "#79C0FF", "#8B949E", "#58A6FF", "#F85149", "#0D1117",
        "#30363D", "#484F58", "#D2A8FF", "#79C0FF", "#79C0FF",
        "#7EE787", "#A5D6FF", "#79C0FF", "#C9D1D9", "#FFA657",
        "#D2A8FF", "#C9D1D9", "#C9D1D9", "#FF7B72", "#79C0FF",
        "#FFA657", "#2A1D1F", "#16252B", "#1E1B2E", "#16241B"
    }),

    GITHUB_LIGHT("github-light", new String[] {
        "#FFFFFF", "#F6F8FA", "#D0D7DE", "#DDE3E9", "#24292F",
        "#1F2328", "#1A7F37", "#0550AE", "#953800", "#0A3069",
        "#0550AE", "#6E7781", "#0969DA", "#CF222E", "#F6F8FA",
        "#D0D7DE", "#AFB8C1", "#8250DF", "#0550AE", "#0550AE",
        "#116329", "#0A3069", "#0550AE", "#24292F", "#953800",
        "#8250DF", "#24292F", "#24292F", "#CF222E", "#0550AE",
        "#953800", "#FFF1F0", "#EAF5F7", "#F3EEFF", "#EDF7EE"
    }),

    SOLARIZED_LIGHT("solarized-light", new String[] {
        "#FDF6E3", "#EEE8D5", "#D6CFB8", "#E0D9C2", "#586E75",
        "#073642", "#859900", "#268BD2", "#B58900", "#2AA198",
        "#2AA198", "#93A1A1", "#268BD2", "#DC322F", "#FDF6E3",
        "#D6CFB8", "#C5BDA4", "#268BD2", "#D33682", "#2AA198",
        "#657B83", "#2AA198", "#268BD2", "#586E75", "#B58900",
        "#6C71C4", "#586E75", "#586E75", "#859900", "#6C71C4",
        "#B58900", "#FBE7E0", "#E4EFEE", "#E9E7F5", "#ECF1E0"
    }),

    TOKYO_NIGHT("tokyo-night", new String[] {
        "#1A1B26", "#24283B", "#414868", "#2F3549", "#A9B1D6",
        "#C0CAF5", "#9ECE6A", "#7AA2F7", "#E0AF68", "#9ECE6A",
        "#7DCFFF", "#565F89", "#7AA2F7", "#F7768E", "#1A1B26",
        "#414868", "#545C7E", "#7AA2F7", "#FF9E64", "#7DCFFF",
        "#E0AF68", "#9ECE6A", "#7DCFFF", "#A9B1D6", "#E0AF68",
        "#BB9AF7", "#A9B1D6", "#A9B1D6", "#89DDFF", "#BB9AF7",
        "#E0AF68", "#2E2130", "#1D2B33", "#252237", "#1E2B22"
    }),

    GRUVBOX_DARK("gruvbox-dark", new String[] {
        "#282828", "#3C3836", "#665C54", "#504945", "#EBDBB2",
        "#D5C4A1", "#B8BB26", "#83A598", "#8EC07C", "#B8BB26",
        "#8EC07C", "#928374", "#83A598", "#FB4934", "#282828",
        "#504945", "#665C54", "#FABD2F", "#D3869B", "#FE8019",
        "#D5C4A1", "#B8BB26", "#8EC07C", "#FE8019", "#D3869B",
        "#83A598", "#EBDBB2", "#EBDBB2", "#EBDBB2", "#D3869B",
        "#83A598", "#402C2C", "#2C3A38", "#34303F", "#2E3B2E"
    }),

    CATPPUCCIN_MOCHA("catppuccin-mocha", new String[] {
        "#1E1E2E", "#313244", "#585B70", "#45475A", "#CDD6F4",
        "#BAC2DE", "#A6E3A1", "#89B4FA", "#94E2D5", "#A6E3A1",
        "#94E2D5", "#6C7086", "#89B4FA", "#F38BA8", "#1E1E2E",
        "#45475A", "#585B70", "#F9E2AF", "#FAB387", "#F5C2E7",
        "#BAC2DE", "#A6E3A1", "#94E2D5", "#F9E2AF", "#CBA6F7",
        "#89B4FA", "#CDD6F4", "#CDD6F4", "#CDD6F4", "#CBA6F7",
        "#89B4FA", "#3A2A31", "#2A3340", "#332A3D", "#2C3A32"
    }),

    CATPPUCCIN_LATTE("catppuccin-latte", new String[] {
        "#EFF1F5", "#E6E9EF", "#BCC0CC", "#DCE0E8", "#4C4F69",
        "#5C5F77", "#40A02B", "#1E66F5", "#179299", "#40A02B",
        "#179299", "#8C8FA1", "#1E66F5", "#D20F39", "#EFF1F5",
        "#DCE0E8", "#BCC0CC", "#DF8E1D", "#FE640B", "#EA76CB",
        "#5C5F77", "#40A02B", "#179299", "#DF8E1D", "#8839EF",
        "#1E66F5", "#4C4F69", "#4C4F69", "#4C4F69", "#8839EF",
        "#1E66F5", "#FCE7EC", "#E3F1F0", "#EDE7FB", "#E9F3E6"
    }),

    SOLARIZED_DARK("solarized-dark", new String[] {
        "#002B36", "#073642", "#586E75", "#0F4A56", "#93A1A1",
        "#839496", "#859900", "#268BD2", "#2AA198", "#2AA198",
        "#2AA198", "#586E75", "#268BD2", "#DC322F", "#002B36",
        "#0F4A56", "#586E75", "#268BD2", "#D33682", "#B58900",
        "#93A1A1", "#2AA198", "#2AA198", "#B58900", "#6C71C4",
        "#268BD2", "#93A1A1", "#93A1A1", "#93A1A1", "#6C71C4",
        "#268BD2", "#3A1F26", "#0A3F4B", "#21304A", "#263B26"
    }),

    ONE_LIGHT("one-light", new String[] {
        "#FAFAFA", "#EAEAEB", "#C6C6C8", "#DCDCDE", "#383A42",
        "#4F525E", "#A626A4", "#4078F2", "#0184BC", "#50A14F",
        "#0184BC", "#A0A1A7", "#4078F2", "#E45649", "#FAFAFA",
        "#DCDCDE", "#C6C6C8", "#4078F2", "#986801", "#B76B01",
        "#383A42", "#50A14F", "#0184BC", "#B76B01", "#A626A4",
        "#4078F2", "#383A42", "#383A42", "#383A42", "#A626A4",
        "#4078F2", "#FCE9E9", "#E6F5F7", "#EFE9FB", "#E9F5EC"
    });

    private static final class Vars {
        private static final String[] NAMES = {
            "--vc-bg", "--vc-head-bg", "--vc-border", "--vc-grid", "--vc-text",
            "--vc-head", "--vc-head-key", "--vc-name", "--vc-type", "--vc-value",
            "--vc-check", "--vc-remark", "--vc-accent", "--vc-guide", "--vc-scroll-track",
            "--vc-scroll-thumb", "--vc-scroll-thumb-hover",
            "--vc-func", "--vc-num", "--vc-embed",
            "--vc-attr-name", "--vc-attr-value", "--vc-method-cat", "--vc-paren",
            "--vc-bracket", "--vc-brace", "--vc-comma", "--vc-dot", "--vc-op",
            "--vc-bool", "--vc-array",
            "--vc-head-bg-event-decl", "--vc-head-bg-event-recv",
            "--vc-head-bg-prop-get", "--vc-head-bg-prop-set"
        };

        private Vars() {
        }
    }

    private final String id;
    private final Map<String, String> vars;
    private final String styleTag;

    ThemePalette(String id, String[] values) {
        if (values.length != Vars.NAMES.length) {
            throw new IllegalStateException("主题 " + id + " 的变量数量不对：" + values.length);
        }
        this.id = id;
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < Vars.NAMES.length; i++) {
            map.put(Vars.NAMES[i], values[i]);
        }
        this.vars = map;
        this.styleTag = "<style id=\"voldev-theme\">:root{"
            + map.entrySet().stream()
                .map(e -> e.getKey() + ":" + e.getValue())
                .collect(Collectors.joining(";"))
            + ";}</style>";
    }

    public String getId() {
        return id;
    }

    public static ThemePalette of(String id) {
        if (id != null) {
            for (ThemePalette palette : values()) {
                if (palette.id.equalsIgnoreCase(id.trim())) {
                    return palette;
                }
            }
        }
        return DARK;
    }

    public String toStyleTag() {
        return styleTag;
    }
}
