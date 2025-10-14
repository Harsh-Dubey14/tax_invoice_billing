import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ChakraProvider, Box } from "@chakra-ui/react";
import BillingDashboard from "./pages/billingDoc"; // ✅ correct import

const App = () => {
  return (
    <ChakraProvider>
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
    </ChakraProvider>
  );
};

export default App;
