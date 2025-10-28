import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ChakraProvider, Box, ColorModeScript } from "@chakra-ui/react";
import BillingDashboard from "./pages/billingDoc"; // ✅ correct import
import ThemeProviderWrapper from "./theme/ThemeProviderWrapper";

const App = () => {
  return (
    <ChakraProvider>
      {/* This ensures Chakra starts with the correct initial color mode */}
      <ColorModeScript />
      
      {/* Wrap the entire app with ThemeProviderWrapper */}
      <ThemeProviderWrapper>
        <Router>
          <Box p={4}>
            <Routes>
              {/* Redirect root ("/") to /billing */}
              <Route path="/" element={<Navigate to="/billing" replace />} />

              {/* Billing dashboard route */}
              <Route path="/billing" element={<BillingDashboard />} />
            </Routes>
          </Box>
        </Router>
      </ThemeProviderWrapper>
    </ChakraProvider>
  );
};

export default App;
