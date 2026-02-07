import { createRoot } from "react-dom/client";
import { useState, useCallback } from "react";
import App from "./App.tsx";
import { SplashScreen } from "./components/ui/splash-screen.tsx";
import "./index.css";

function Root() {
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash on first load per session
    if (sessionStorage.getItem('openflip_splashed')) return false;
    sessionStorage.setItem('openflip_splashed', '1');
    return true;
  });

  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <App />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
