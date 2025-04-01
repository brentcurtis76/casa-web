
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Function to check if fonts are loaded
const checkFontsLoaded = () => {
  // Create a promise that resolves when fonts are loaded
  return document.fonts.ready.then(() => {
    console.log("All fonts are loaded");
    return true;
  }).catch(err => {
    console.error("Error loading fonts:", err);
    return true; // Continue anyway
  });
};

// Render app
const renderApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
};

// Wait for fonts to load before rendering the app
checkFontsLoaded().then(renderApp);
