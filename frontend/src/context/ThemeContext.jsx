import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // tasteskill "Sheet and biro" defaults to crisp light sheet (#ffffff)
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('oms_theme_v2')
    return saved === 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('oms_theme_v2', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('oms_theme_v2', 'light')
    }
  }, [dark])

  const toggleTheme = () => setDark((d) => !d)

  return (
    <ThemeContext.Provider value={{ dark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
