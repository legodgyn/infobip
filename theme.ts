"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2563eb",
    },
    background: {
      default: "#f6f8fb",
      paper: "#ffffff",
    },
    text: {
      primary: "#101828",
      secondary: "#667085",
    },
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: "Inter, Arial, sans-serif",
    h4: {
      fontWeight: 900,
    },
    h6: {
      fontWeight: 800,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 28,
          border: "1px solid #eef2f6",
          boxShadow: "0 18px 45px rgba(16, 24, 40, 0.06)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: "none",
          fontWeight: 800,
        },
      },
    },
  },
});