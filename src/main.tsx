import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeRuntime } from "./platform/runtime";
import "./styles.css";

initializeRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
