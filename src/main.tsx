import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeRuntime } from "./platform/runtime";
import "./styles.css";
import "./adv/runtime.css";

initializeRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
