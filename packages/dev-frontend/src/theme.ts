import { Theme, ThemeUIStyleObject } from "theme-ui";

const baseColors = {
  blue: "#1542cd",
  purple: "#745ddf",
  cyan: "#2eb6ea",
  green: "#28c081",
  yellow: "#fd9d28",
  red: "#dc2c10",
  lightRed: "#ff755f"
};

const colors = {
  primary: baseColors.blue,
  secondary: baseColors.purple,
  accent: baseColors.cyan,

  success: baseColors.green,
  warning: baseColors.yellow,
  danger: baseColors.red,
  dangerHover: baseColors.lightRed,
  info: baseColors.blue,
  invalid: "pink",

  text: "#293147",
  background: "white",
  muted: "#eaebed",
  highlight: "#efeffe"
};

const buttonBase: ThemeUIStyleObject = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  ":enabled": { cursor: "pointer" }
};

const button: ThemeUIStyleObject = {
  ...buttonBase,

  px: "32px",
  py: "12px",

  color: "white",
  border: 1,

  fontWeight: "bold",

  ":disabled": {
    opacity: 0.5
  }
};

const buttonOutline = (color: string, hoverColor: string): ThemeUIStyleObject => ({
  color,
  borderColor: color,
  background: "none",

  ":enabled:hover": {
    color: "background",
    bg: hoverColor,
    borderColor: hoverColor
  }
});

const iconButton: ThemeUIStyleObject = {
  ...buttonBase,

  padding: 0,
  width: "40px",
  height: "40px",

  background: "none",

  ":disabled": {
    color: "text",
    opacity: 0.25
  }
};

const cardHeadingFontSize = 18.7167;

const cardGapX = [0, 3, 4];
const cardGapY = [3, 3, 4];

const card: ThemeUIStyleObject = {
  position: "relative",
  mt: cardGapY,
  border: 1,
  boxShadow: [1, null, 2]
};

const infoCard: ThemeUIStyleObject = {
  ...card,

  padding: 3,

  borderColor: "rgba(122,199,240,0.4)",
  background: "linear-gradient(200deg, #d4d9fc, #cae9f9)",

  h2: {
    mb: 2,
    fontSize: cardHeadingFontSize
  }
};

const formBase: ThemeUIStyleObject = {
  display: "block",
  width: "auto",
  flexShrink: 0,
  padding: 2,
  fontSize: 3
};

const formCell: ThemeUIStyleObject = {
  ...formBase,

  bg: "background",
  border: 1,
  borderColor: "muted",
  borderRadius: 0,
  boxShadow: [1, 2]
};

const overlay: ThemeUIStyleObject = {
  position: "absolute",

  left: 0,
  top: 0,
  width: "100%",
  height: "100%"
};

const modalOverlay: ThemeUIStyleObject = {
  position: "fixed",

  left: 0,
  top: 0,
  width: "100vw",
  height: "100vh"
};

const headerGradient: ThemeUIStyleObject = {
  background: `linear-gradient(90deg, ${colors.background}, ${colors.muted})`
};

const theme: Theme = {
  breakpoints: ["48em", "52em", "64em"],

  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],

  fonts: {
    body: [
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "sans-serif"
    ].join(", "),
    heading: "inherit",
    monospace: "Menlo, monospace"
  },

  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64, 96],

  fontWeights: {
    body: 400,
    heading: 600,

    light: 200,
    medium: 500,
    bold: 600
  },

  lineHeights: {
    body: 1.5,
    heading: 1.25
  },

  colors,

  borders: [0, "1px solid", "2px solid"],

  shadows: ["0", "0px 4px 8px rgba(41, 49, 71, 0.1)", "0px 8px 16px rgba(41, 49, 71, 0.1)"],

  text: {
    address: {
      fontFamily: "monospace",
      fontSize: 1
    }
  },

  buttons: {
    primary: {
      ...button,

      bg: "primary",
      borderColor: "primary",

      ":enabled:hover": {
        bg: "secondary",
        borderColor: "secondary"
      }
    },

    outline: {
      ...button,
      ...buttonOutline("primary", "secondary")
    },

    cancel: {
      ...button,
      ...buttonOutline("text", "text"),

      opacity: 0.8
    },

    danger: {
      ...button,

      bg: "danger",
      borderColor: "danger",

      ":enabled:hover": {
        bg: "dangerHover",
        borderColor: "dangerHover"
      }
    },

    icon: {
      ...iconButton,
      color: "primary",
      ":enabled:hover": { color: "accent" }
    },

    dangerIcon: {
      ...iconButton,
      color: "danger",
      ":enabled:hover": { color: "dangerHover" }
    },

    titleIcon: {
      ...iconButton,
      color: "text",
      ":enabled:hover": { color: "success" }
    },

    close: {
      cursor: "pointer"
    }
  },

  cards: {
    primary: {
      ...card,

      padding: 0,

      borderColor: "muted",
      bg: "background",

      "> h2": {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",

        height: "56px",

        pl: 3,
        py: 2,
        pr: 2,

        bg: "muted",

        fontSize: cardHeadingFontSize
      }
    },

    info: {
      ...infoCard,

      display: ["none", "block"]
    },

    infoPopup: {
      ...infoCard,

      position: "fixed",
      top: 0,
      right: 3,
      left: 3,
      mt: "72px",
      height: "80%",
      overflowY: "scroll"
    },

    tooltip: {
      fontWeight: "body",
      marginY: 1,

      a: {
        color: "accent",
        ":hover": {
          opacity: 0.8
        }
      }
    }
  },

  forms: {
    label: {
      ...formBase
    },

    radioLabel: {
      mr: 4,
      width: "unset",

      svg: {
        mr: 1
      }
    },

    unit: {
      ...formCell,

      textAlign: "center",
      bg: "muted"
    },

    input: {
      ...formCell,

      flex: 1
    },

    editor: {}
  },

  layout: {
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "stretch",

      position: ["fixed", "relative"],
      top: 0,
      zIndex: 1,

      px: [2, "12px", "12px", 5],
      py: [2, "12px", "12px"],

      ...headerGradient,
      boxShadow: [1, "none"]
    },

    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      mt: cardGapY,
      px: 3,
      minHeight: "72px",

      bg: "muted"
    },

    main: {
      width: "100%",
      maxWidth: "1280px",
      mx: "auto",
      mt: ["40px", 0],
      mb: ["40px", "40px"],
      px: cardGapX
    },

    columns: {
      display: "flex",
      flexWrap: "wrap",
      justifyItems: "center"
    },

    left: {
      pr: cardGapX,
      width: ["100%", "58%"]
    },

    right: {
      width: ["100%", "42%"]
    },

    actions: {
      justifyContent: "flex-end",
      mt: 2,

      button: {
        ml: 2
      }
    },

    disabledOverlay: {
      ...overlay,

      bg: "rgba(255, 255, 255, 0.5)"
    },

    modalOverlay: {
      ...modalOverlay,

      bg: "rgba(0, 0, 0, 0.8)",

      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    },

    modal: {
      padding: 3,
      width: ["100%", "40em"]
    },

    infoOverlay: {
      ...modalOverlay,

      display: ["block", "none"],

      bg: "rgba(255, 255, 255, 0.8)"
    },

    infoMessage: {
      display: "flex",
      justifyContent: "center",
      m: 3,
      alignItems: "center",
      minWidth: "128px"
    },

    sidenav: {
      display: ["flex", "none"],
      flexDirection: "column",
      p: 0,
      m: 0,
      borderColor: "muted",
      mr: "25vw",
      height: "100%",
      ...headerGradient
    },

    badge: {
      border: 0,
      borderRadius: 3,
      p: 1,
      px: 2,
      backgroundColor: "muted",
      color: "slate",
      fontSize: 1,
      fontWeight: "body"
    }
  },

  styles: {
    root: {
      fontFamily: "body",
      lineHeight: "body",
      fontWeight: "body",

      height: "100%",

      "#root": {
        height: "100%"
      }
    },

    a: {
      color: "primary",
      ":hover": { color: "accent" },
      textDecoration: "none",
      fontWeight: "bold"
    },

    progress: {
      color: colors.success
    }
  },

  links: {
    nav: {
      px: 2,
      py: 1,
      fontWeight: "medium",
      fontSize: 2,
      textTransform: "uppercase",
      letterSpacing: "2px",
      width: ["100%", "auto"],
      mt: [3, "auto"]
    }
  }
};

export default theme;
