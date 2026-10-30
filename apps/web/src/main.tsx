import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import App from "./App";
import "antd/dist/reset.css";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><ConfigProvider theme={{ token: { colorPrimary: "#166534", borderRadius: 8, fontFamily: "Inter, system-ui, sans-serif" } }}><App /></ConfigProvider></React.StrictMode>);
