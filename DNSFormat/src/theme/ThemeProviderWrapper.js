import React, { createContext, useContext } from "react";
import { useColorMode } from "@chakra-ui/react";

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const ThemeProviderWrapper = ({ children }) => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <ThemeContext.Provider value={{ colorMode, toggleColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProviderWrapper;
